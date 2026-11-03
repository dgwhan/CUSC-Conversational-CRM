import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Message, Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service.js";
import { InboundEvent } from "../domain/inbound-event.js";
import { Channel, MessageDirection } from "../domain/channel.js";
import {
    resolveTagMappings,
    CRM_SYSTEM_TAGS,
    META_SOURCE_TAGS,
} from "../domain/tag-mapping/index.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalizeWorkspaceId = (workspaceId?: string): string | undefined =>
    workspaceId && UUID_REGEX.test(workspaceId) ? workspaceId : undefined;

function normalizeChannel(rawChannel?: unknown): Channel | undefined {
    if (!rawChannel || typeof rawChannel !== 'string') return undefined;
    const upper = rawChannel.trim().toUpperCase();
    if (!upper || upper === 'ALL' || upper === 'UNDEFINED' || upper === 'NULL') {
        return undefined;
    }
    if (upper === 'ZALO' || upper === 'ZALO_PERSONAL' || upper.includes('ZALO')) {
        return Channel.ZALO;
    }
    if (upper === 'FACEBOOK' || upper === 'FB' || upper.includes('FACEBOOK')) {
        return Channel.FACEBOOK;
    }
    if (upper === 'TIKTOK' || upper.includes('TIKTOK')) {
        return Channel.TIKTOK;
    }
    if (upper === 'MANUAL_IMPORT' || upper.includes('MANUAL') || upper.includes('CSV')) {
        return Channel.MANUAL_IMPORT;
    }
    if (Object.values(Channel).includes(upper as Channel)) {
        return upper as Channel;
    }
    return undefined;
}

@Injectable()
export class MessageRepository implements OnModuleInit {
    private readonly logger = new Logger(MessageRepository.name);

    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit(): Promise<void> {
        // Tự động quét và chuẩn hóa các cột conversation_id, processed_at, attachments bị null trong DB
        await this.backfillNullFields();
    }

    async findById(id: string): Promise<Message | null> {
        return this.prisma.message.findUnique({
            where: { id },
        });
    }

    async markProcessed(id: string, processedAt: Date = new Date()): Promise<void> {
        await this.prisma.message.update({
            where: { id },
            data: { processedAt },
        });
    }

    async findMany(options?: {
        workspaceId?: string;
        limit?: number;
        offset?: number;
        channel?: Channel | string;
        search?: string;
    }): Promise<{ items: any[]; total: number }> {
        const safeWorkspaceId = normalizeWorkspaceId(options?.workspaceId);
        const normalizedChannel = normalizeChannel(options?.channel);

        const andConditions: Prisma.MessageWhereInput[] = [];

        if (safeWorkspaceId) {
            andConditions.push({
                OR: [
                    { channelAccount: { workspaceId: safeWorkspaceId } },
                    { conversation: { workspaceId: safeWorkspaceId } },
                ],
            });
        }

        if (normalizedChannel) {
            andConditions.push({
                channel: normalizedChannel,
            });
        }

        if (options?.search && typeof options.search === 'string' && options.search.trim()) {
            const searchTerm = options.search.trim();
            andConditions.push({
                OR: [
                    { content: { contains: searchTerm, mode: 'insensitive' } },
                    { externalMessageId: { contains: searchTerm, mode: 'insensitive' } },
                ],
            });
        }

        const where: Prisma.MessageWhereInput = andConditions.length > 0
            ? { AND: andConditions }
            : {};

        let items: any[] = [];
        let total = 0;

        try {
            [items, total] = await Promise.all([
                this.prisma.message.findMany({
                    where,
                    include: {
                        channelAccount: {
                            select: {
                                displayName: true,
                                externalAccountId: true,
                                avatarUrl: true,
                                metadata: true,
                            },
                        },
                        conversation: {
                            include: {
                                customer: true,
                            },
                        },
                    },
                    orderBy: { sentAt: 'desc' },
                    take: options?.limit ?? 50,
                    skip: options?.offset ?? 0,
                }),
                this.prisma.message.count({ where }),
            ]);
        } catch (dbErr: any) {
            this.logger.error(`Database error in MessageRepository.findMany: ${dbErr?.message || dbErr}`, dbErr?.stack);
            return { items: [], total: 0 };
        }

        const mappedItems = (items || []).map((m: any) => {
            try {
                let raw = m.rawPayload;
                if (typeof raw === 'string') {
                    try {
                        raw = JSON.parse(raw);
                    } catch {
                        raw = {};
                    }
                }
                if (!raw || typeof raw !== 'object') {
                    raw = {};
                }

                const customer = m.conversation?.customer;
                const isOutbound = m.direction === 'OUTBOUND' || m.direction === MessageDirection.OUTBOUND;

                let customerFbId: string | null = null;
                let customerZaloId: string | null = null;
                if (customer?.channelIdentities) {
                    if (Array.isArray(customer.channelIdentities)) {
                        const fb = customer.channelIdentities.find((i: any) => i?.channel === 'FACEBOOK' || i?.channel === Channel.FACEBOOK);
                        if (fb?.externalUserId) customerFbId = String(fb.externalUserId);
                        const za = customer.channelIdentities.find((i: any) => i?.channel === 'ZALO' || i?.channel === Channel.ZALO);
                        if (za?.externalUserId) customerZaloId = String(za.externalUserId);
                    } else if (typeof customer.channelIdentities === 'object') {
                        const idents = customer.channelIdentities as any;
                        if (idents.facebook) customerFbId = String(idents.facebook);
                        if (idents.zalo?.id) customerZaloId = String(idents.zalo.id);
                        else if (idents.zalo) customerZaloId = String(idents.zalo);
                    }
                }

                const recipientExternalId =
                    raw.recipient?.id ||
                    raw.to?.data?.[0]?.id ||
                    raw.to?.id ||
                    customerFbId ||
                    customerZaloId ||
                    customer?.id ||
                    null;

                const senderExternalId =
                    isOutbound && recipientExternalId
                        ? recipientExternalId
                        : (raw.senderExternalId ||
                           raw.sender?.id ||
                           raw.from?.id ||
                           customerFbId ||
                           customerZaloId ||
                           customer?.id ||
                           'unknown');

                const customerName =
                    customer?.fullName ||
                    raw.customerName ||
                    raw.from?.name ||
                    raw.sender?.name ||
                    null;

                const customerAvatar =
                    customer?.avatarUrl ||
                    raw.customerAvatar ||
                    null;

                const tags =
                    (Array.isArray(m.conversation?.tags) && m.conversation.tags.length > 0)
                        ? m.conversation.tags
                        : (Array.isArray(raw.tags) && raw.tags.length > 0 ? raw.tags : []);

                return {
                    ...m,
                    senderExternalId,
                    customerName,
                    customerAvatar,
                    customerPhone: customer?.phone || null,
                    customerEmail: customer?.email || null,
                    tags,
                };
            } catch {
                return m;
            }
        });

        return { items: mappedItems, total };
    }

    async insertManyIgnoreDuplicate(
        events: InboundEvent[],
    ): Promise<Array<{ id: string; conversationId: string | null }>> {
        if (events.length === 0) {
            return [];
        }

        // 1. Khử trùng lặp ngay trong cùng một batch (tránh lỗi PostgreSQL không thể affect cùng 1 hàng 2 lần trong 1 lệnh)
        const seenKeys = new Set<string>();
        const uniqueEvents: InboundEvent[] = [];
        for (const event of events) {
            const key = `${event.channel}:${event.externalMessageId}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniqueEvents.push(event);
            }
        }

        // 2. Đảm bảo tồn tại ChannelAccount cho từng cặp (channel, externalAccountId)
        const uniqueAccounts = new Map<string, { channel: InboundEvent['channel']; externalAccountId: string; workspaceId?: string }>();
        for (const event of uniqueEvents) {
            const key = `${event.channel}:${event.externalAccountId}`;
            if (!uniqueAccounts.has(key)) {
                uniqueAccounts.set(key, {
                    channel: event.channel,
                    externalAccountId: event.externalAccountId,
                    workspaceId: event.workspaceId,
                });
            }
        }

        const accountMap = new Map<string, string>();
        for (const [key, { channel, externalAccountId, workspaceId }] of uniqueAccounts.entries()) {
            const account = await this.prisma.channelAccount.upsert({
                where: {
                    channel_externalAccountId: {
                        channel,
                        externalAccountId,
                    },
                },
                update: workspaceId ? { workspaceId } : {},
                create: {
                    channel,
                    externalAccountId,
                    displayName: externalAccountId,
                    workspaceId,
                },
                select: { id: true },
            });
            accountMap.set(key, account.id);
        }

        // 3. Chuẩn bị dữ liệu messages và tự động liên kết conversation_id, attachments, processed_at
        const messagesData: Prisma.MessageCreateManyInput[] = [];

        for (const e of uniqueEvents) {
            const accountId = accountMap.get(`${e.channel}:${e.externalAccountId}`)!;
            const messageSentAt = e.sentAt ? new Date(e.sentAt) : new Date();
            const raw = (e.rawPayload as any) || {};

            // A. Xác định hoặc tìm/tạo conversationId
            let conversationId: string | null = e.conversationId || raw.conversationId || null;

            if (!conversationId) {
                try {
                    const isOutbound = e.direction === MessageDirection.OUTBOUND;
                    const customerExternalId = isOutbound
                        ? (raw.recipient?.id || raw.to?.data?.[0]?.id || raw.to?.id || e.senderExternalId)
                        : e.senderExternalId;

                    let customerId = raw.customerId || null;

                    // Tìm customer theo channelIdentities
                    if (!customerId && customerExternalId && customerExternalId !== 'unknown') {
                        const cust = await this.prisma.customer.findFirst({
                            where: {
                                OR: [
                                    { channelIdentities: { path: [e.channel.toLowerCase()], equals: String(customerExternalId) } },
                                    { channelIdentities: { path: [e.channel.toLowerCase(), 'id'], equals: String(customerExternalId) } },
                                    { channelIdentities: { path: ['socialId'], equals: String(customerExternalId) } },
                                ],
                            },
                            select: { id: true },
                        });
                        if (cust) {
                            customerId = cust.id;
                        }
                    }

                    // Tìm cuộc hội thoại đã có
                    let conv = await this.prisma.conversation.findFirst({
                        where: {
                            channelAccountId: accountId,
                            ...(customerId ? { customerId } : {}),
                        },
                        select: { id: true, tags: true, lastMessageAt: true, lastCustomerMessageAt: true },
                    });

                    const isOutOfOrder = Boolean(
                        conv?.lastMessageAt && messageSentAt.getTime() < new Date(conv.lastMessageAt).getTime()
                    );
                    const isLatestCustomerMessage = Boolean(
                        !isOutbound &&
                        (!conv?.lastCustomerMessageAt ||
                            messageSentAt.getTime() > new Date(conv.lastCustomerMessageAt).getTime())
                    );

                    // Phân giải tag ánh xạ (Facebook Lead -> Lead, idempotent & out-of-order safe)
                    const rawTags: string[] = Array.isArray(raw.tags) && raw.tags.length > 0
                        ? raw.tags
                        : (e.channel === Channel.FACEBOOK ? [META_SOURCE_TAGS.FACEBOOK_LEAD] : [CRM_SYSTEM_TAGS.NEW_CUSTOMER]);

                    const tagResult = resolveTagMappings({
                        channel: e.channel,
                        currentTags: conv?.tags || [],
                        sourceTags: rawTags,
                        eventTimestamp: messageSentAt,
                        lastSyncTimestamp: conv?.lastMessageAt,
                    });
                    const finalTags = tagResult.finalTags;

                    // Nếu chưa có thì tự động tạo mới cuộc hội thoại
                    if (!conv) {
                        conv = await this.prisma.conversation.create({
                            data: {
                                workspaceId: e.workspaceId || uniqueAccounts.get(`${e.channel}:${e.externalAccountId}`)?.workspaceId || null,
                                channelAccountId: accountId,
                                customerId: customerId || null,
                                status: 'OPEN',
                                snippet: e.content || 'Tin nhắn mới',
                                lastMessageAt: messageSentAt,
                                lastCustomerMessageAt: !isOutbound ? messageSentAt : undefined,
                                tags: finalTags,
                            },
                            select: { id: true, tags: true, lastMessageAt: true, lastCustomerMessageAt: true },
                        });
                    } else {
                        // Cập nhật lại snippet, lastMessageAt và tags của Conversation (bảo vệ chống ghi đè lùi nếu tin nhắn out-of-order)
                        await this.prisma.conversation.update({
                            where: { id: conv.id },
                            data: {
                                ...(isLatestCustomerMessage ? { lastCustomerMessageAt: messageSentAt } : {}),
                                ...(isOutOfOrder ? {} : {
                                    snippet: e.content || undefined,
                                    lastMessageAt: messageSentAt,
                                }),
                                tags: finalTags,
                            },
                        });
                    }

                    conversationId = conv.id;
                } catch {
                    // Tiếp tục lưu tin nhắn ngay cả khi tạo Conversation gặp lỗi non-fatal
                }
            }

            // B. Trích xuất attachments
            let attachments: any = e.attachments || raw.attachments || null;
            if (!attachments && raw.message?.attachments) {
                const fbAtts = raw.message.attachments;
                if (Array.isArray(fbAtts) && fbAtts.length > 0) {
                    attachments = fbAtts.map((att: any, idx: number) => {
                        const type = String(att.type || 'FILE').toUpperCase();
                        const url = att.payload?.url || att.url || '';
                        return {
                            id: att.id || `att-${Date.now()}-${idx}`,
                            type: type === 'IMAGE' ? 'IMAGE' : type === 'AUDIO' ? 'AUDIO' : 'FILE',
                            url,
                            name: att.payload?.name || att.name || `${type.toLowerCase()}_attachment`,
                            size: att.payload?.size,
                            duration: att.payload?.duration,
                        };
                    });
                }
            }

            // C. Trích xuất processedAt (Outbound và Sync đã hoàn thành xử lý)
            let processedAt: Date | null = e.processedAt || null;
            if (!processedAt) {
                if (e.direction === MessageDirection.OUTBOUND || raw.isSync) {
                    processedAt = messageSentAt;
                }
            }

            messagesData.push({
                channelAccountId: accountId,
                conversationId,
                channel: e.channel,
                direction: e.direction ?? MessageDirection.INBOUND,
                content: e.content,
                attachments: attachments ? (attachments as Prisma.InputJsonValue) : undefined,
                sentAt: messageSentAt,
                createdAt: messageSentAt,
                processedAt,
                externalMessageId: e.externalMessageId,
                rawPayload: (e.rawPayload ?? {}) as Prisma.InputJsonValue,
            });
        }

        // 4. Chỉ các dòng mới được chèn thực sự mới được trả về cho worker.
        return this.prisma.message.createManyAndReturn({
            data: messagesData,
            skipDuplicates: true,
            select: { id: true, conversationId: true },
        });
    }

    /**
     * Tự động quét và cập nhật các cột conversation_id, processed_at, attachments
     * bị null cho các tin nhắn đã tồn tại trong CSDL
     */
    async backfillNullFields(): Promise<{ updatedConversations: number; updatedProcessedAt: number; updatedAttachments: number }> {
        let updatedConversations = 0;
        let updatedProcessedAt = 0;
        let updatedAttachments = 0;

        try {
            // 1. Tìm các message có conversationId null
            const nullConvMessages = await this.prisma.message.findMany({
                where: { conversationId: null },
                take: 200,
            });

            for (const msg of nullConvMessages) {
                const raw = (msg.rawPayload as any) || {};
                const isOutbound = msg.direction === MessageDirection.OUTBOUND;
                const customerExternalId = isOutbound
                    ? (raw.recipient?.id || raw.to?.data?.[0]?.id || raw.to?.id)
                    : (raw.senderExternalId || raw.sender?.id || raw.from?.id);

                let customerId = raw.customerId || null;
                if (!customerId && customerExternalId) {
                    const cust = await this.prisma.customer.findFirst({
                        where: {
                            OR: [
                                { channelIdentities: { path: [msg.channel.toLowerCase()], equals: String(customerExternalId) } },
                                { channelIdentities: { path: [msg.channel.toLowerCase(), 'id'], equals: String(customerExternalId) } },
                                { channelIdentities: { path: ['socialId'], equals: String(customerExternalId) } },
                            ],
                        },
                        select: { id: true },
                    });
                    if (cust) customerId = cust.id;
                }

                // Tìm hoặc tạo conversation
                let conv = await this.prisma.conversation.findFirst({
                    where: {
                        channelAccountId: msg.channelAccountId,
                        ...(customerId ? { customerId } : {}),
                    },
                    select: { id: true },
                });

                if (!conv) {
                    const tagResult = resolveTagMappings({
                        channel: msg.channel,
                        currentTags: [],
                        sourceTags: msg.channel === Channel.FACEBOOK ? [META_SOURCE_TAGS.FACEBOOK_LEAD] : [CRM_SYSTEM_TAGS.NEW_CUSTOMER],
                    });
                    conv = await this.prisma.conversation.create({
                        data: {
                            channelAccountId: msg.channelAccountId,
                            customerId: customerId || null,
                            status: 'OPEN',
                            snippet: msg.content || 'Tin nhắn',
                            lastMessageAt: msg.sentAt,
                            tags: tagResult.finalTags,
                        },
                        select: { id: true },
                    });
                }

                await this.prisma.message.update({
                    where: { id: msg.id },
                    data: { conversationId: conv.id },
                });
                updatedConversations++;
            }

            // 2. Cập nhật processed_at cho các tin nhắn đang bị null
            const nullProcessed = await this.prisma.message.updateMany({
                where: { processedAt: null },
                data: { processedAt: new Date() },
            });
            updatedProcessedAt = nullProcessed.count;

            // 3. Cập nhật attachments từ rawPayload cho các tin nhắn bị null
            const nullAttMessages = await this.prisma.message.findMany({
                where: { attachments: { equals: Prisma.DbNull } },
                take: 200,
            });

            for (const msg of nullAttMessages) {
                const raw = (msg.rawPayload as any) || {};
                const fbAtts = raw.message?.attachments || raw.attachments?.data || raw.attachments;
                if (Array.isArray(fbAtts) && fbAtts.length > 0) {
                    const parsed = fbAtts.map((att: any, idx: number) => ({
                        id: att.id || `att-${Date.now()}-${idx}`,
                        type: String(att.type || 'FILE').toUpperCase(),
                        url: att.payload?.url || att.url || '',
                        name: att.payload?.name || att.name || `${att.type}_attachment`,
                        size: att.payload?.size,
                        duration: att.payload?.duration,
                    }));

                    await this.prisma.message.update({
                        where: { id: msg.id },
                        data: { attachments: parsed as Prisma.InputJsonValue },
                    });
                    updatedAttachments++;
                }
            }
        } catch {
            // Không ngắt app nếu backfill gặp lỗi
        }

        return { updatedConversations, updatedProcessedAt, updatedAttachments };
    }
}
