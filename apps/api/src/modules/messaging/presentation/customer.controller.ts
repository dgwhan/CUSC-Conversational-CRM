import {
    Controller,
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
import { RealtimeService } from '../../realtime/realtime.service.js';
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
    ) { }

    /**
     * Retrieve list of customers within a workspace, supporting search and conversation snippet retrieval.
     */
    @Get()
    async getCustomers(
        @Headers('x-workspace-id') headerWsId?: string,
        @Query('workspaceId') queryWsId?: string,
        @Query('search') search?: string,
    ) {
        const workspaceId = queryWsId || headerWsId;
        const where: any = {};

        if (workspaceId) {
            where.workspaceId = workspaceId;
        }

        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

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
                    take: 1,
                },
            },
            orderBy: { updatedAt: 'desc' },
            take: 100,
        });

        const mappedItems = items.map((c: any) => {
            const identities = (c.channelIdentities as any) || {};
            const convTags = Array.isArray(c.conversations?.[0]?.tags) ? c.conversations[0].tags : [];
            const identityTags = Array.isArray(identities.tags) ? identities.tags : [];
            const tags = Array.from(new Set([...convTags, ...identityTags]));
            const hasExplicitTags = Array.isArray(identities.tags) || (c.conversations?.[0] && Array.isArray(c.conversations[0].tags));

            return {
                ...c,
                leadStatus: c.leadStatus || identities.leadStatus || 'NEW',
                leadStage: c.leadStage || identities.leadStage || null,
                interestCourses: identities.interestCourses || [],
                estimatedValue: identities.estimatedValue || 0,
                tags: hasExplicitTags ? tags : (c.leadStatus === 'POTENTIAL' ? ['Lead'] : ['Khách hàng mới']),
            };
        });

        return { items: mappedItems, total: items.length };
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
    ) {
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let existing: any = null;

        //Match exact standard UUID
        if (UUID_REGEX.test(id)) {
            try {
                existing = await this.prisma.customer.findUnique({ where: { id } });
            } catch {
                existing = null;
            }
        }

        //Match prefixed UUIDs (e.g., cust-<uuid> or cand-<uuid>)
        if (!existing) {
            const strippedUuid = id.replace(/^(cust|cand)-/, '');
            if (UUID_REGEX.test(strippedUuid)) {
                try {
                    existing = await this.prisma.customer.findUnique({ where: { id: strippedUuid } });
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
                                    { channelIdentities: { path: ['zalo'], equals: senderExternalId } },
                                    { channelIdentities: { path: ['socialId'], equals: senderExternalId } },
                                ],
                            },
                            orderBy: { updatedAt: 'desc' },
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
                            { channelIdentities: { path: ['zalo'], equals: cleanSocialId } },
                            { channelIdentities: { path: ['socialId'], equals: cleanSocialId } },
                            { channelIdentities: { path: ['facebook'], equals: id } },
                            ...(validPhone ? [{ phone: validPhone }] : []),
                            ...(validEmail ? [{ email: validEmail }] : []),
                            ...(validName ? [{ fullName: validName }] : []),
                        ],
                    },
                    orderBy: { updatedAt: 'desc' },
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
                    ...(body.fullName ? { fullName: body.fullName } : {}),
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
                    ...(body.fullName ? { fullName: body.fullName } : {}),
                    ...(body.phone !== undefined ? { phone: body.phone } : {}),
                    ...(body.email !== undefined ? { email: body.email } : {}),
                    channelIdentities: updatedIdentities,
                },
            });
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
                this.realtime?.broadcastPipelineChange({
                    customerId: existing.id,
                    customerName: updated.fullName,
                    newStage: (body.leadStage || existing.leadStage || 'STAGE_NEW') as string,
                    previousStage: (existing.leadStage || 'STAGE_NEW') as string,
                    updatedBy: body.updatedBy || 'Hệ thống CRM',
                });
            } catch { }
        }

        return {
            ...updated,
            leadStatus: updated.leadStatus || updatedIdentities.leadStatus || 'NEW',
            leadStage: updated.leadStage || updatedIdentities.leadStage || null,
            interestCourses: updatedIdentities.interestCourses || [],
            estimatedValue: updatedIdentities.estimatedValue || 0,
            tags: cleanTags || updatedIdentities.tags || [],
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
