import {
    Controller,
    NotFoundException,
    Get,
    Patch,
    Delete,
    Param,
    Body,
    Headers,
    Query,
    Optional,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { Prisma } from '@prisma/client';
import { RealtimeService } from '../../realtime/realtime.service.js';
import { ContactMergeService } from '../application/contact-merge.service.js';
import { standardizeVietnamesePhoneNumber } from '../../customers/domain/phone-standardizer.js';
import { removeVietnameseTones, matchesUnaccent } from '../../customers/domain/unaccent.js';
import {
    deduplicateTags,
    tagSyncLogger,
    TAG_SYNC_STAGE,
    TAG_SYNC_ERROR_TYPE,
    TAG_EVENT_SOURCE,
} from '../domain/tag-mapping/index.js';

/**
 * Controller managing workspace customers, recruitment leads, and pipeline stages.
 */
@Controller('customers')
export class CustomerController {
    private readonly logger = new Logger(CustomerController.name);

    constructor(
        private readonly prisma: PrismaService,
        @Optional() private readonly realtime?: RealtimeService,
        @Optional() private readonly mergeService?: ContactMergeService,
    ) { }

    /**
     * Retrieve list of customers within a workspace, supporting pagination, unaccent search, and phone lookup 
     */
    @Get()
    async getCustomers(
        @Headers('x-workspace-id') headerWsId?: string,
        @Query('workspaceId') queryWsId?: string,
        @Query('search') search?: string,
        @Query('page') pageStr?: string,
        @Query('limit') limitStr?: string,
        @Query('leadStatus') leadStatus?: string,
        @Query('leadStage') leadStage?: string,
    ) {
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const rawWsId = (queryWsId || headerWsId || '').trim();
        const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(limitStr || '20', 10) || 20));
        const skip = (page - 1) * limit;

        const where: any = {};

        if (rawWsId) {
            if (UUID_REGEX.test(rawWsId)) {
                where.workspaceId = rawWsId;
            } else {
                return { items: [], total: 0, page, limit, totalPages: 0 };
            }
        }

        if (leadStatus && leadStatus.trim()) {
            where.leadStatus = leadStatus.trim();
        }

        if (leadStage && leadStage.trim()) {
            where.leadStage = leadStage.trim();
        }

        let fallbackFilterNeeded = false;
        let cleanSearchTerm = '';

        if (search && search.trim()) {
            cleanSearchTerm = search.trim();
            const rawDigits = cleanSearchTerm.replace(/\D/g, '');
            const stdPhone = rawDigits.length >= 7 ? standardizeVietnamesePhoneNumber(rawDigits) : null;
            const searchPattern = `%${cleanSearchTerm}%`;
            const phonePattern = rawDigits.length >= 4 ? `%${rawDigits}%` : null;

            let matchedIds: string[] | null = null;

            try {
                if (typeof this.prisma.$queryRaw === 'function') {
                    const wsClause = rawWsId && UUID_REGEX.test(rawWsId) ? Prisma.sql`AND c.workspace_id = ${rawWsId}::uuid` : Prisma.empty;
                    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
                        SELECT c.id FROM customers c
                        WHERE (
                            lower(unaccent(c.full_name)) LIKE lower(unaccent(${searchPattern}))
                            OR lower(COALESCE(c.email, '')) LIKE lower(${searchPattern})
                            OR (c.notes IS NOT NULL AND lower(unaccent(c.notes)) LIKE lower(unaccent(${searchPattern})))
                            ${phonePattern ? Prisma.sql`OR c.phone LIKE ${phonePattern} OR replace(replace(replace(COALESCE(c.phone, ''), ' ', ''), '.', ''), '-', '') LIKE ${phonePattern}` : Prisma.empty}
                            ${stdPhone ? Prisma.sql`OR c.phone = ${stdPhone}` : Prisma.empty}
                        )
                        ${wsClause}
                    `;
                    matchedIds = rows.map((r) => r.id);
                }
            } catch {
                matchedIds = null;
                fallbackFilterNeeded = true;
            }

            if (matchedIds !== null) {
                if (matchedIds.length === 0) {
                    return { items: [], total: 0, page, limit, totalPages: 0 };
                }
                where.id = { in: matchedIds };
            } else {
                where.OR = [
                    { fullName: { contains: cleanSearchTerm, mode: 'insensitive' } },
                    { phone: { contains: cleanSearchTerm, mode: 'insensitive' } },
                    { email: { contains: cleanSearchTerm, mode: 'insensitive' } },
                    ...(stdPhone ? [{ phone: stdPhone }] : []),
                    ...(phonePattern ? [{ phone: { contains: rawDigits } }] : []),
                ];
            }
        }

        try {
            const [items, total] = await Promise.all([
                this.prisma.customer.findMany({
                    where,
                    include: {
                        conversations: {
                            include: {
                                channelAccount: {
                                    select: {
                                        displayName: true,
                                        channel: true,
                                        avatarUrl: true,
                                    },
                                },
                            },
                            orderBy: { lastMessageAt: 'desc' },
                            take: 20,
                        },
                    },
                    orderBy: { updatedAt: 'desc' },
                    skip,
                    take: limit,
                }),
                this.prisma.customer.count({ where }),
            ]);

            let mappedItems = items.map((c: any) => {
                const identities = (c.channelIdentities as any) || {};
                const convTags = Array.isArray(c.conversations?.[0]?.tags) ? c.conversations[0].tags : [];
                const identityTags = Array.isArray(identities.tags) ? identities.tags : [];
                const tags = Array.from(new Set([...convTags, ...identityTags]));
                const hasExplicitTags = Array.isArray(identities.tags) || (c.conversations?.[0] && Array.isArray(c.conversations[0].tags));

                return {
                    ...c,
                    leadStatus: c.leadStatus || identities.leadStatus || 'NEW',
                    leadStage: c.leadStage || identities.leadStage || null,
                    notes: c.notes || identities.notes || null,
                    interestCourses: identities.interestCourses || [],
                    estimatedValue: identities.estimatedValue || 0,
                    tags: hasExplicitTags ? tags : (c.leadStatus === 'POTENTIAL' ? ['Lead'] : ['Khách hàng mới']),
                };
            });

            // Fallback in-memory unaccent filter nếu Prisma mock hoặc DB không hỗ trợ queryRaw
            if (fallbackFilterNeeded && cleanSearchTerm) {
                mappedItems = mappedItems.filter((item) => {
                    if (matchesUnaccent(item.fullName, cleanSearchTerm)) return true;
                    if (matchesUnaccent(item.notes, cleanSearchTerm)) return true;
                    if (item.phone && item.phone.includes(cleanSearchTerm.replace(/\D/g, ''))) return true;
                    if (item.email && item.email.toLowerCase().includes(cleanSearchTerm.toLowerCase())) return true;
                    return false;
                });
            }

            return {
                items: mappedItems,
                total: fallbackFilterNeeded ? mappedItems.length : total,
                page,
                limit,
                totalPages: Math.ceil((fallbackFilterNeeded ? mappedItems.length : total) / limit) || 1,
            };
        } catch (error) {
            this.logger.error(`Error in getCustomers: ${(error as Error).message}`, (error as Error).stack);
            return { items: [], total: 0, page, limit, totalPages: 0 };
        }
    }

    /**
     * Retrieve single customer details by ID (including conversations, notes, identities)
     */
    @Get(':id')
    async getCustomerById(
        @Param('id') id: string,
        @Headers('x-workspace-id') headerWsId?: string,
        @Query('workspaceId') queryWsId?: string,
    ) {
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let customer: any = null;

        if (UUID_REGEX.test(id)) {
            customer = await this.prisma.customer.findUnique({
                where: { id },
                include: {
                    conversations: {
                        include: {
                            channelAccount: {
                                select: {
                                    displayName: true,
                                    channel: true,
                                    avatarUrl: true,
                                },
                            },
                        },
                        orderBy: { lastMessageAt: 'desc' },
                        take: 20,
                    },
                },
            });
        } else {
            const stripped = id.replace(/^(cust|cand)-/, '');
            if (UUID_REGEX.test(stripped)) {
                customer = await this.prisma.customer.findUnique({
                    where: { id: stripped },
                    include: {
                        conversations: {
                            include: {
                                channelAccount: {
                                    select: {
                                        displayName: true,
                                        channel: true,
                                        avatarUrl: true,
                                    },
                                },
                            },
                            orderBy: { lastMessageAt: 'desc' },
                            take: 20,
                        },
                    },
                });
            }
        }

        if (!customer) {
            throw new NotFoundException('Khách hàng không tồn tại hoặc đã bị xóa');
        }

        const identities = (customer.channelIdentities as any) || {};
        const convTags = Array.isArray(customer.conversations?.[0]?.tags) ? customer.conversations[0].tags : [];
        const identityTags = Array.isArray(identities.tags) ? identities.tags : [];
        const tags = Array.from(new Set([...convTags, ...identityTags]));

        return {
            ...customer,
            leadStatus: customer.leadStatus || identities.leadStatus || 'NEW',
            leadStage: customer.leadStage || identities.leadStage || null,
            notes: customer.notes || identities.notes || null,
            interestCourses: identities.interestCourses || [],
            estimatedValue: identities.estimatedValue || 0,
            tags: tags.length ? tags : (customer.leadStatus === 'POTENTIAL' ? ['Lead'] : ['Khách hàng mới']),
        };
    }

    /**
     * Update customer profile, recruitment pipeline stage, and lead qualification status.
     * Automatically broadcasts real-time pipeline changes to connected staff.
     */
    @Patch(':id')
    async updateCustomer(
        @Param('id') id: string,
        @Body() body: {
            fullName?: string;
            notes?: string;
            phone?: string;
            email?: string;
            interestCourses?: string[];
            estimatedValue?: number;
            leadStage?: string;
            leadStatus?: string;
            updatedBy?: string;
            tags?: string[];
            conversationId?: string;
        },
        @Headers('x-workspace-id') headerWsId?: string,
    ) {
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let existing: any = null;

        //Match exact standard UUID
        if (UUID_REGEX.test(id)) {
            try {
                existing = await this.prisma.customer.findUnique({ where: { id }, include: { conversations: { include: { channelAccount: true }, take: 1, orderBy: { lastMessageAt: 'desc' } } } });
            } catch {
                existing = null;
            }
        }

        //Match prefixed UUIDs (e.g., cust-<uuid> or cand-<uuid>)
        if (!existing) {
            const strippedUuid = id.replace(/^(cust|cand)-/, '');
            if (UUID_REGEX.test(strippedUuid)) {
                try {
                    existing = await this.prisma.customer.findUnique({ where: { id: strippedUuid }, include: { conversations: { include: { channelAccount: true }, take: 1, orderBy: { lastMessageAt: 'desc' } } } });
                } catch {
                    existing = null;
                }
            }
        }

        // Match via conversationId if provided
        if (!existing && body.conversationId) {
            if (UUID_REGEX.test(body.conversationId)) {
                try {
                    const conv = await this.prisma.conversation.findUnique({
                        where: { id: body.conversationId },
                        include: { customer: true },
                    });
                    if (conv?.customer) {
                        existing = conv.customer;
                    }
                } catch {
                    existing = null;
                }
            } else {
                // If conversationId is synthetic like FACEBOOK_<extId>_<senderId> or ZALO_<senderId>
                const parts = body.conversationId.split('_');
                const channel = parts[0]?.toLowerCase();
                const senderExternalId = parts.length >= 3 ? parts.slice(2).join('_') : (parts.length === 2 ? parts[1] : null);
                if (senderExternalId) {
                    try {
                        existing = await this.prisma.customer.findFirst({
                            where: {
                                OR: [
                                    ...(channel ? [{ channelIdentities: { path: [channel], equals: senderExternalId } }] : []),
                                    { channelIdentities: { path: ['facebook'], equals: senderExternalId } },
                                    { channelIdentities: { path: ['zalo', 'id'], equals: senderExternalId } },
                                    { channelIdentities: { path: ['zalo'], equals: senderExternalId } },
                                    { channelIdentities: { path: ['socialId'], equals: senderExternalId } },
                                ],
                            },
                            orderBy: { updatedAt: 'desc' },
                            include: { conversations: { include: { channelAccount: true }, take: 1, orderBy: { lastMessageAt: 'desc' } } },
                        });
                    } catch {
                        existing = null;
                    }
                }
            }
        }

        //Fallback to socialId or personal identifier lookups
        if (!existing) {
            const cleanSocialId = id.replace(/^(cust|cand)-(facebook-|zalo-)?/, '').replace(/^(facebook|zalo)-/, '');
            const validPhone = body.phone && body.phone !== 'Chưa có SĐT' ? body.phone : null;
            const validEmail = body.email && body.email !== 'Chưa có Email' ? body.email : null;
            const validName = body.fullName && !body.fullName.startsWith('Khách hàng') && !body.fullName.startsWith('Lead') ? body.fullName : null;

            try {
                existing = await this.prisma.customer.findFirst({
                    where: {
                        OR: [
                            { channelIdentities: { path: ['facebook'], equals: cleanSocialId } },
                            { channelIdentities: { path: ['zalo', 'id'], equals: cleanSocialId } },
                            { channelIdentities: { path: ['zalo'], equals: cleanSocialId } },
                            { channelIdentities: { path: ['socialId'], equals: cleanSocialId } },
                            { channelIdentities: { path: ['facebook'], equals: id } },
                            ...(validPhone ? [{ phone: validPhone }] : []),
                            ...(validEmail ? [{ email: validEmail }] : []),
                            ...(validName ? [{ fullName: validName }] : []),
                        ],
                    },
                    orderBy: { updatedAt: 'desc' },
                    include: { conversations: { include: { channelAccount: true }, take: 1, orderBy: { lastMessageAt: 'desc' } } },
                });
            } catch {
                existing = null;
            }
        }

        //Upsert fallback: Provision new Customer if not found in database
        if (!existing) {
            const cleanSocialId = id.replace(/^(cust|cand)-(facebook-|zalo-)?/, '').replace(/^(facebook|zalo)-/, '');
            const validPhone = body.phone && body.phone !== 'Chưa có SĐT' ? body.phone : null;
            const validEmail = body.email && body.email !== 'Chưa có Email' ? body.email : null;
            let newCust: any;
            try {
                newCust = await this.prisma.customer.create({
                    data: {
                        ...(headerWsId && UUID_REGEX.test(headerWsId) ? { workspaceId: headerWsId } : {}),
                        fullName: body.fullName || (id.startsWith('cand-') ? 'Ứng viên mới' : 'Khách hàng'),
                        phone: validPhone,
                        email: validEmail,
                        leadStatus: body.leadStatus || 'NEW',
                        leadStage: body.leadStage || 'STAGE_NEW',
                        channelIdentities: {
                            socialId: cleanSocialId,
                            facebook: cleanSocialId,
                            leadStatus: body.leadStatus || 'NEW',
                            leadStage: body.leadStage || 'STAGE_NEW',
                            ...(body.interestCourses !== undefined ? { interestCourses: body.interestCourses } : {}),
                            ...(body.estimatedValue !== undefined ? { estimatedValue: body.estimatedValue } : {}),
                            ...(body.tags !== undefined ? { tags: body.tags } : {}),
                        },
                    },
                });
            } catch {
                newCust = await this.prisma.customer.create({
                    data: {
                        ...(headerWsId && UUID_REGEX.test(headerWsId) ? { workspaceId: headerWsId } : {}),
                        fullName: body.fullName || (id.startsWith('cand-') ? 'Ứng viên mới' : 'Khách hàng'),
                        phone: validPhone,
                        email: validEmail,
                        channelIdentities: {
                            socialId: cleanSocialId,
                            facebook: cleanSocialId,
                            leadStatus: body.leadStatus || 'NEW',
                            leadStage: body.leadStage || 'STAGE_NEW',
                            ...(body.interestCourses !== undefined ? { interestCourses: body.interestCourses } : {}),
                            ...(body.estimatedValue !== undefined ? { estimatedValue: body.estimatedValue } : {}),
                            ...(body.tags !== undefined ? { tags: body.tags } : {}),
                        },
                    },
                });
            }

            if (body.conversationId && UUID_REGEX.test(body.conversationId)) {
                try {
                    await this.prisma.conversation.update({
                        where: { id: body.conversationId },
                        data: { customerId: newCust.id },
                    });
                } catch { }
            }

            if (body.leadStage !== undefined || body.leadStatus !== undefined) {
                try {
                    this.realtime?.broadcastPipelineChange({
                        customerId: newCust.id,
                        customerName: newCust.fullName,
                        newStage: (body.leadStage || 'STAGE_NEW') as string,
                        previousStage: 'STAGE_NEW',
                        updatedBy: body.updatedBy || 'Hệ thống CRM',
                    });
                } catch { }
            }

            return {
                ...newCust,
                leadStatus: newCust.leadStatus || body.leadStatus || 'NEW',
                leadStage: newCust.leadStage || body.leadStage || 'STAGE_NEW',
                interestCourses: body.interestCourses || [],
                estimatedValue: body.estimatedValue || 0,
            };
        }

        const currentIdentities = (existing.channelIdentities as any) || {};

        // Xử lý danh sách tags và phát hiện các tag bị gỡ thủ công qua CRM
        let cleanTags: string[] | undefined;
        let manuallyRemovedTags: string[] | undefined;
        if (body.tags !== undefined) {
            cleanTags = deduplicateTags(body.tags);
            const prevTags: string[] = Array.isArray(currentIdentities.tags) ? currentIdentities.tags : [];
            const removed = prevTags.filter(
                (pt: string) => !cleanTags!.some((ct: string) => ct.trim().toLowerCase() === pt.trim().toLowerCase())
            );
            const additionalRemoved: string[] = [];
            for (const r of removed) {
                const lower = r.trim().toLowerCase();
                if (lower === 'lead') {
                    additionalRemoved.push('Facebook Lead');
                } else if (lower === 'facebook lead') {
                    additionalRemoved.push('Lead');
                }
            }
            const prevManuallyRemoved: string[] = Array.isArray(currentIdentities.manuallyRemovedTags)
                ? currentIdentities.manuallyRemovedTags
                : [];
            manuallyRemovedTags = deduplicateTags([...prevManuallyRemoved, ...removed, ...additionalRemoved]);
        }

        const updatedIdentities = {
            ...currentIdentities,
            ...(body.interestCourses !== undefined ? { interestCourses: body.interestCourses } : {}),
            ...(body.estimatedValue !== undefined ? { estimatedValue: body.estimatedValue } : {}),
            ...(body.leadStage !== undefined ? { leadStage: body.leadStage } : {}),
            ...(body.leadStatus !== undefined ? { leadStatus: body.leadStatus } : {}),
            ...(cleanTags !== undefined ? { tags: cleanTags, manuallyRemovedTags } : {}),
        };

        let updated: any;
        try {
            updated = await this.prisma.customer.update({
                where: { id: existing.id },
                data: {
                    ...(headerWsId && UUID_REGEX.test(headerWsId) && !existing.workspaceId ? { workspaceId: headerWsId } : {}),
                    ...(body.fullName ? { fullName: body.fullName } : {}),
                    ...(body.notes !== undefined ? { notes: body.notes } : {}),
                    ...(body.phone !== undefined ? { phone: body.phone } : {}),
                    ...(body.email !== undefined ? { email: body.email } : {}),
                    ...(body.leadStatus !== undefined ? { leadStatus: body.leadStatus } : {}),
                    ...(body.leadStage !== undefined ? { leadStage: body.leadStage } : {}),
                    channelIdentities: updatedIdentities,
                },
            });
        } catch {
            updated = await this.prisma.customer.update({
                where: { id: existing.id },
                data: {
                    ...(headerWsId && UUID_REGEX.test(headerWsId) && !existing.workspaceId ? { workspaceId: headerWsId } : {}),
                    ...(body.fullName ? { fullName: body.fullName } : {}),
                    ...(body.notes !== undefined ? { notes: body.notes } : {}),
                    ...(body.phone !== undefined ? { phone: body.phone } : {}),
                    ...(body.email !== undefined ? { email: body.email } : {}),
                    channelIdentities: updatedIdentities,
                },
            });
        }

        // Xử lý chuẩn hóa SĐT và tự động gộp Contact theo SĐT (CUS-04)
        let mergedResult: any = null;
        if (body.phone && body.phone !== 'Chưa có SĐT' && this.mergeService) {
            const normalizedPhone = standardizeVietnamesePhoneNumber(body.phone);
            if (normalizedPhone) {
                try {
                    const currentIdentities = (existing.channelIdentities as any) || {};
                    const fbId = currentIdentities.facebook || (existing.id.startsWith('facebook-') ? existing.id.replace('facebook-', '') : null);
                    const zaloId = currentIdentities.zalo?.id || (typeof currentIdentities.zalo === 'string' ? currentIdentities.zalo : null) || currentIdentities.zaloId || currentIdentities.socialId;

                    let currentContact = null;
                    if (fbId || zaloId) {
                        const idnt = await this.prisma.channelIdentity.findFirst({
                            where: {
                                OR: [
                                    fbId ? { channel: 'FACEBOOK', externalUserId: String(fbId) } : undefined,
                                    zaloId ? { channel: 'ZALO', externalUserId: String(zaloId) } : undefined,
                                ].filter(Boolean) as any,
                            },
                            include: { contact: true },
                        });
                        currentContact = idnt?.contact || null;
                    }

                    const collisionCheck = await this.mergeService.checkDuplicatePhone(normalizedPhone, currentContact?.id);
                    if (collisionCheck.hasCollision && collisionCheck.existingContact) {
                        if (currentContact && currentContact.id !== collisionCheck.existingContact.id) {
                            mergedResult = await this.mergeService.mergeContacts({
                                targetContactId: collisionCheck.existingContact.id,
                                sourceContactId: currentContact.id,
                                phoneNormalized: normalizedPhone,
                                actorId: body.updatedBy,
                                mergeType: 'AUTO_PHONE_MATCH',
                                reason: 'Tự động gộp khách hàng theo SĐT (CUS-04)',
                                workspaceId: headerWsId,
                            });
                            this.logger.log(`[CUS-04] Auto-merged contact ${currentContact.id} into ${collisionCheck.existingContact.id} via phone ${normalizedPhone}`);
                        }
                    } else if (currentContact && !currentContact.phoneNormalized) {
                        await this.prisma.contact.update({
                            where: { id: currentContact.id },
                            data: { phoneNormalized: normalizedPhone },
                        }).catch(() => { });
                    }
                } catch (mergeErr) {
                    this.logger.warn(`Lưu ý khi xử lý gộp SĐT CUS-04: ${(mergeErr as Error).message}`);
                }
            }
        }

        // Đồng bộ cập nhật tag vào cuộc hội thoại
        if (cleanTags !== undefined && this.prisma.conversation) {
            try {
                const isConvUuid = body.conversationId && UUID_REGEX.test(body.conversationId);
                const convWhere = isConvUuid
                    ? { id: body.conversationId }
                    : { customerId: existing.id };

                await this.prisma.conversation.updateMany({
                    where: convWhere,
                    data: {
                        tags: cleanTags,
                    },
                });
            } catch (err) {
                this.logger.warn(`Could not update conversation tags: ${(err as Error).message}`);
                tagSyncLogger.logError({
                    stage: TAG_SYNC_STAGE.UPDATE,
                    errorType: TAG_SYNC_ERROR_TYPE.TAG_DATABASE_ERROR,
                    message: `Không thể đồng bộ nhãn hội thoại vào CSDL: ${(err as Error).message}`,
                    eventSource: TAG_EVENT_SOURCE.CRM_MANUAL_ACTION,
                    customerId: existing.id,
                    conversationId: body.conversationId,
                    targetTags: cleanTags,
                    error: err,
                });
            }
        }

        if (body.leadStage !== undefined || body.leadStatus !== undefined) {
            try {
                const firstConv = existing.conversations?.[0];
                this.realtime?.broadcastPipelineChange({
                    customerId: existing.id,
                    customerName: updated.fullName,
                    newStage: (body.leadStage || existing.leadStage || 'STAGE_NEW') as string,
                    previousStage: (existing.leadStage || 'STAGE_NEW') as string,
                    updatedBy: body.updatedBy || 'Hệ thống CRM',
                    phone: updated.phone || undefined,
                    email: updated.email || undefined,
                    avatarUrl: updated.avatarUrl || undefined,
                    channel: firstConv?.channelAccount?.channel || 'ZALO',
                    channelAccountName: firstConv?.channelAccount?.displayName || 'Kênh trực tuyến',
                    estimatedValue: updatedIdentities.estimatedValue || 0,
                    interestCourses: updatedIdentities.interestCourses || [],
                    tags: cleanTags || updatedIdentities.tags || ['Lead'],
                    conversationId: body.conversationId || firstConv?.id,
                } as any);
            } catch { }
        }

        return {
            ...updated,
            leadStatus: updated.leadStatus || updatedIdentities.leadStatus || 'NEW',
            leadStage: updated.leadStage || updatedIdentities.leadStage || null,
            interestCourses: updatedIdentities.interestCourses || [],
            estimatedValue: updatedIdentities.estimatedValue || 0,
            tags: cleanTags || updatedIdentities.tags || [],
            ...(mergedResult ? { isMerged: true, mergeResult: mergedResult } : {}),
        };
    }

    /**
     * Gỡ trực tiếp một tag khỏi khách hàng và hội thoại thông qua CRM
     */
    @Delete(':id/tags/:tag')
    async removeCustomerTag(
        @Param('id') id: string,
        @Param('tag') tagToRemove: string,
    ) {
        let existing: any = null;
        try {
            existing = await this.prisma.customer.findFirst({
                where: {
                    OR: [
                        { id },
                        { channelIdentities: { path: ['facebook'], equals: id } },
                        { channelIdentities: { path: ['zalo'], equals: id } },
                    ],
                },
                include: {
                    conversations: {
                        select: { id: true, tags: true },
                    },
                },
            });
        } catch {
            existing = null;
        }

        if (!existing) {
            return { success: false, message: 'Customer not found' };
        }

        const identities = (existing.channelIdentities as any) || {};
        const currentIdentityTags: string[] = Array.isArray(identities.tags) ? identities.tags : [];
        const convTags: string[] = existing.conversations?.[0]?.tags || [];
        const allCurrent = Array.from(new Set([...currentIdentityTags, ...convTags]));

        const isTargetTag = (t: string) => {
            const lower = t.trim().toLowerCase();
            const removeLower = tagToRemove.trim().toLowerCase();
            if (lower === removeLower) return true;
            if (removeLower === 'lead' && (lower === 'facebook lead' || lower === 'fb lead')) return true;
            if ((removeLower === 'facebook lead' || removeLower === 'fb lead') && lower === 'lead') return true;
            return false;
        };

        const nextTags = allCurrent.filter((t) => !isTargetTag(t));
        const prevManuallyRemoved: string[] = Array.isArray(identities.manuallyRemovedTags) ? identities.manuallyRemovedTags : [];
        const tagsToMark = [tagToRemove];
        if (tagToRemove.trim().toLowerCase() === 'lead') {
            tagsToMark.push('Facebook Lead');
        } else if (tagToRemove.trim().toLowerCase() === 'facebook lead') {
            tagsToMark.push('Lead');
        }
        const manuallyRemovedTags = deduplicateTags([...prevManuallyRemoved, ...tagsToMark]);

        const updated = await this.prisma.customer.update({
            where: { id: existing.id },
            data: {
                channelIdentities: {
                    ...identities,
                    tags: nextTags,
                    manuallyRemovedTags,
                },
            },
        });

        if (this.prisma.conversation) {
            try {
                await this.prisma.conversation.updateMany({
                    where: { customerId: existing.id },
                    data: { tags: nextTags },
                });
            } catch (err) {
                tagSyncLogger.logError({
                    stage: TAG_SYNC_STAGE.DELETE,
                    errorType: TAG_SYNC_ERROR_TYPE.TAG_DATABASE_ERROR,
                    message: `Không thể đồng bộ gỡ nhãn hội thoại trong CSDL: ${(err as Error).message}`,
                    eventSource: TAG_EVENT_SOURCE.CRM_MANUAL_ACTION,
                    customerId: existing.id,
                    targetTags: nextTags,
                    error: err,
                });
            }
        }

        this.logger.log(`Tư vấn viên gỡ tag "${tagToRemove}" khỏi khách hàng "${updated.fullName}" (${updated.id}) qua CRM`);

        return {
            success: true,
            id: updated.id,
            tags: nextTags,
            removedTag: tagToRemove,
        };
    }
}
