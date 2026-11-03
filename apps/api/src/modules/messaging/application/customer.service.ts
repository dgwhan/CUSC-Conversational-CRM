import { Injectable, NotFoundException, Optional, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { RealtimeService } from '../../realtime/realtime.service.js';
import { ContactMergeService } from './contact-merge.service.js';
import { CustomerTagService } from './customer-tag.service.js';
import { standardizeVietnamesePhoneNumber } from '../../customers/domain/phone-standardizer.js';
import { matchesUnaccent } from '../../customers/domain/unaccent.js';
import { deduplicateTags } from '../domain/tag-mapping/index.js';

export interface GetCustomersParams {
    rawWsId?: string;
    search?: string;
    pageStr?: string;
    limitStr?: string;
    leadStatus?: string;
    leadStage?: string;
}

export class UpdateCustomerDto {
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
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class CustomerService {
    private readonly logger = new Logger(CustomerService.name);
    private readonly tagService: CustomerTagService;

    constructor(
        private readonly prisma: PrismaService,
        @Optional() private readonly realtime?: RealtimeService,
        @Optional() private readonly mergeService?: ContactMergeService,
        @Optional() tagService?: CustomerTagService,
    ) {
        this.tagService = tagService || new CustomerTagService(prisma);
    }

    /**
     * Retrieve list of customers within a workspace, supporting pagination, unaccent search, and phone lookup
     */
    async getCustomers(params: GetCustomersParams) {
        const { rawWsId, search, pageStr, limitStr, leadStatus, leadStage } = params;
        const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(limitStr || '20', 10) || 20));
        const skip = (page - 1) * limit;

        const where: any = {};

        // Only pass workspaceId to Prisma if it's a valid UUID — reject fallback slugs like "ws-default-001"
        if (rawWsId && UUID_REGEX.test(rawWsId)) {
            where.workspaceId = rawWsId;
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
            const items = await this.prisma.customer.findMany({
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
            });

            const total = typeof this.prisma.customer.count === 'function'
                ? await this.prisma.customer.count({ where })
                : items.length;

            let mappedItems = items.map((c: any) => this.mapCustomerDto(c));

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
    async getCustomerById(id: string) {
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

        return this.mapCustomerDto(customer);
    }

    /**
     * Update customer profile, recruitment pipeline stage, and lead qualification status.
     * Automatically broadcasts real-time pipeline changes to connected staff.
     */
    async updateCustomer(id: string, body: UpdateCustomerDto, headerWsId?: string) {
        let existing = await this.findExistingCustomer(id, body.conversationId, body);

        // Upsert fallback: Provision new Customer if not found in database
        if (!existing) {
            return this.provisionNewCustomer(id, body, headerWsId);
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
            mergedResult = await this.handlePhoneMerge(existing, body.phone, headerWsId, body.updatedBy);
        }

        // Đồng bộ cập nhật tag vào cuộc hội thoại
        if (cleanTags !== undefined && this.prisma.conversation) {
            await this.syncConversationTags(existing.id, body.conversationId, cleanTags);
        }

        if (body.leadStage !== undefined || body.leadStatus !== undefined) {
            try {
                const firstConv = existing.conversations?.[0];
                const payload: any = {
                    customerId: existing.id,
                    customerName: updated.fullName,
                    newStage: (body.leadStage || existing.leadStage || 'STAGE_NEW') as string,
                    previousStage: (existing.leadStage || 'STAGE_NEW') as string,
                    updatedBy: body.updatedBy || 'Hệ thống CRM',
                };
                if (updated.phone) payload.phone = updated.phone;
                if (updated.email) payload.email = updated.email;
                if (updated.avatarUrl) payload.avatarUrl = updated.avatarUrl;
                if (firstConv?.channelAccount?.channel) payload.channel = firstConv.channelAccount.channel;
                if (firstConv?.channelAccount?.displayName) payload.channelAccountName = firstConv.channelAccount.displayName;
                if (updatedIdentities.estimatedValue) payload.estimatedValue = updatedIdentities.estimatedValue;
                if (updatedIdentities.interestCourses?.length) payload.interestCourses = updatedIdentities.interestCourses;
                if (cleanTags || updatedIdentities.tags) payload.tags = cleanTags || updatedIdentities.tags;
                if (body.conversationId || firstConv?.id) payload.conversationId = body.conversationId || firstConv?.id;

                this.realtime?.broadcastPipelineChange(payload);
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
    async removeCustomerTag(id: string, tagToRemove: string) {
        return this.tagService.removeCustomerTag(id, tagToRemove);
    }

    // ==========================================
    // Internal Domain Helpers
    // ==========================================

    private mapCustomerDto(customer: any) {
        const identities = (customer.channelIdentities as any) || {};
        const convTags = Array.isArray(customer.conversations?.[0]?.tags) ? customer.conversations[0].tags : [];
        const identityTags = Array.isArray(identities.tags) ? identities.tags : [];
        const tags = Array.from(new Set([...convTags, ...identityTags]));
        const hasExplicitTags = Array.isArray(identities.tags) || (customer.conversations?.[0] && Array.isArray(customer.conversations[0].tags));

        return {
            ...customer,
            leadStatus: customer.leadStatus || identities.leadStatus || 'NEW',
            leadStage: customer.leadStage || identities.leadStage || null,
            notes: customer.notes || identities.notes || null,
            interestCourses: identities.interestCourses || [],
            estimatedValue: identities.estimatedValue || 0,
            tags: hasExplicitTags ? tags : (customer.leadStatus === 'POTENTIAL' ? ['Lead'] : ['Khách hàng mới']),
        };
    }

    private async findExistingCustomer(id: string, conversationId?: string, body?: UpdateCustomerDto): Promise<any> {
        let existing: any = null;

        // 1. Match exact standard UUID
        if (UUID_REGEX.test(id)) {
            try {
                existing = await this.prisma.customer.findUnique({
                    where: { id },
                    include: { conversations: { include: { channelAccount: true }, take: 1, orderBy: { lastMessageAt: 'desc' } } },
                });
            } catch {
                existing = null;
            }
        }

        // 2. Match prefixed UUIDs (e.g., cust-<uuid> or cand-<uuid>)
        if (!existing) {
            const strippedUuid = id.replace(/^(cust|cand)-/, '');
            if (UUID_REGEX.test(strippedUuid)) {
                try {
                    existing = await this.prisma.customer.findUnique({
                        where: { id: strippedUuid },
                        include: { conversations: { include: { channelAccount: true }, take: 1, orderBy: { lastMessageAt: 'desc' } } },
                    });
                } catch {
                    existing = null;
                }
            }
        }

        // 3. Match via conversationId if provided
        if (!existing && conversationId) {
            if (UUID_REGEX.test(conversationId)) {
                try {
                    const conv = await this.prisma.conversation.findUnique({
                        where: { id: conversationId },
                        include: { customer: true },
                    });
                    if (conv?.customer) {
                        existing = conv.customer;
                    }
                } catch {
                    existing = null;
                }
            } else {
                const parts = conversationId.split('_');
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

        // 4. Fallback to socialId or personal identifier lookups
        if (!existing) {
            const cleanSocialId = id.replace(/^(cust|cand)-(facebook-|zalo-)?/, '').replace(/^(facebook|zalo)-/, '');
            const validPhone = body?.phone && body.phone !== 'Chưa có SĐT' ? body.phone : null;
            const validEmail = body?.email && body.email !== 'Chưa có Email' ? body.email : null;
            const validName = body?.fullName && !body.fullName.startsWith('Khách hàng') && !body.fullName.startsWith('Lead') ? body.fullName : null;

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

        return existing;
    }

    private async provisionNewCustomer(id: string, body: UpdateCustomerDto, headerWsId?: string) {
        const cleanSocialId = id.replace(/^(cust|cand)-(facebook-|zalo-)?/, '').replace(/^(facebook|zalo)-/, '');
        const validPhone = body.phone && body.phone !== 'Chưa có SĐT' ? body.phone : null;
        const validEmail = body.email && body.email !== 'Chưa có Email' ? body.email : null;
        let newCust: any;

        const customerPayload = {
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
        };

        try {
            newCust = await this.prisma.customer.create({
                data: {
                    ...(headerWsId && UUID_REGEX.test(headerWsId) ? { workspaceId: headerWsId } : {}),
                    ...customerPayload,
                },
            });
        } catch {
            newCust = await this.prisma.customer.create({
                data: {
                    ...(headerWsId && UUID_REGEX.test(headerWsId) ? { workspaceId: headerWsId } : {}),
                    fullName: customerPayload.fullName,
                    phone: customerPayload.phone,
                    email: customerPayload.email,
                    channelIdentities: customerPayload.channelIdentities,
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

    private async handlePhoneMerge(existing: any, phone: string, headerWsId?: string, updatedBy?: string) {
        const normalizedPhone = standardizeVietnamesePhoneNumber(phone);
        if (!normalizedPhone || !this.mergeService) return null;

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
                    const mergedResult = await this.mergeService.mergeContacts({
                        targetContactId: collisionCheck.existingContact.id,
                        sourceContactId: currentContact.id,
                        phoneNormalized: normalizedPhone,
                        actorId: updatedBy,
                        mergeType: 'AUTO_PHONE_MATCH',
                        reason: 'Tự động gộp khách hàng theo SĐT',
                        workspaceId: headerWsId,
                    });
                    this.logger.log(`[CUS-04] Auto-merged contact ${currentContact.id} into ${collisionCheck.existingContact.id} via phone ${normalizedPhone}`);
                    return mergedResult;
                }
            } else if (currentContact && !currentContact.phoneNormalized) {
                await this.prisma.contact.update({
                    where: { id: currentContact.id },
                    data: { phoneNormalized: normalizedPhone },
                }).catch(() => { });
            }
        } catch (mergeErr) {
            this.logger.warn(`Lưu ý khi xử lý gộp SĐT: ${(mergeErr as Error).message}`);
        }
        return null;
    }

    private async syncConversationTags(customerId: string, conversationId?: string, cleanTags?: string[]) {
        return this.tagService.syncConversationTags(customerId, conversationId, cleanTags);
    }
}
