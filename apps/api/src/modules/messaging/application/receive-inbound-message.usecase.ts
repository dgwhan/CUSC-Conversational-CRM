import { Inject, Injectable, Logger, Optional, UnauthorizedException } from "@nestjs/common";
import { INBOUND_QUEUE } from "../domain/channel-adapter.port.js";
import type { InboundMessageQueue, RawWebhookRequest } from "../domain/channel-adapter.port.js";
import { Channel } from "../domain/channel.js";
import type { InboundEvent } from "../domain/inbound-event.js";
import { ChannelAdapterRegistry } from "./channel-adapter.registry.js";
import { MessageRepository } from "../infrastructure/message.repository.js";
import { RealtimeService } from "../../realtime/realtime.service.js";
import { PrismaService } from "../../../platform/database/prisma.service.js";
import { CUSTOMER_GATEWAY } from "../domain/customer-gateway.port.js";
import type { CustomerGateway } from "../domain/customer-gateway.port.js";
import {
    resolveTagMappings,
    CRM_SYSTEM_TAGS,
    META_SOURCE_TAGS,
    tagSyncLogger,
    TAG_SYNC_STAGE,
    TAG_SYNC_ERROR_TYPE,
    TAG_EVENT_SOURCE,
} from "../domain/tag-mapping/index.js";

@Injectable()
export class ReceiveInboundMessage {
    private readonly logger = new Logger(ReceiveInboundMessage.name);

    constructor(
        private readonly adapters: ChannelAdapterRegistry,
        private readonly messages: MessageRepository,
        @Inject(INBOUND_QUEUE) private readonly queue: InboundMessageQueue,
        @Optional() private readonly realtime?: RealtimeService,
        @Optional() private readonly prisma?: PrismaService,
        @Optional() @Inject(CUSTOMER_GATEWAY) private readonly customers?: CustomerGateway,
    ) { }

    async execute(req: RawWebhookRequest & { channel: Channel }): Promise<void> {
        const adapter = this.adapters.get(req.channel);

        if (!adapter.verifyRequest(req)) {
            throw new UnauthorizedException('Invalid webhook signature');
        }

        let events: InboundEvent[];
        try {
            events = adapter.parseEvents(req);
        } catch (err) {
            this.logger.error(`parseEvents failed on ${req.channel}`, err as Error);
            return;
        }

        if (events.length === 0) return;

        const created = await this.messages.insertManyIgnoreDuplicate(events);
        if (created.length === 0) return;

        // Bắn sự kiện realtime cho Frontend nếu có RealtimeService
        if (this.realtime) {
            for (let i = 0; i < created.length; i++) {
                const event = events[i];
                const item = created[i];
                if (event && item) {
                    const isOutbound = event.direction === 'OUTBOUND';
                    const raw = (event.rawPayload as any) || {};
                    // Đối với tin echo/outbound từ Page, khách hàng chính là recipient chứ không phải sender (Page ID)
                    const customerExternalId = isOutbound
                        ? (raw.recipient?.id || raw.to?.data?.[0]?.id || raw.to?.id || event.senderExternalId)
                        : event.senderExternalId;

                    // Tạo conversationId theo ngữ cảnh tài khoản và ID khách hàng đối thoại
                    const conversationId = event.externalAccountId && customerExternalId
                        ? `${event.channel}_${event.externalAccountId}_${customerExternalId}`
                        : `conv_${item.id}`;

                    let customerName = isOutbound
                        ? (event.channel === 'ZALO' ? 'Zalo Official Account' : 'Trang (Page Meta)')
                        : (raw.customerName || `Khách hàng (${customerExternalId?.slice(-4) || event.channel})`);
                    let customerAvatar =
                        raw.customerAvatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(customerName)}&background=0284c7&color=fff&bold=true`;
                    let dbCustomer: any = null;
                    let isNewlyCreated = false;

                    // TỰ ĐỘNG TÌM HOẶC TẠO CONTACT & IDENTITY THEO (KÊNH, EXTERNAL_USER_ID)
                    if (!isOutbound && this.customers && event.senderExternalId) {
                        try {
                            const raw = (event.rawPayload as any) || {};
                            const contactResult = await this.customers.findOrCreate({
                                channel: event.channel,
                                senderExternalId: event.senderExternalId,
                                displayName: raw.customerName || raw.displayName || raw.name,
                                rawPayload: event.rawPayload,
                            });
                            const contactObj = contactResult.contact as { displayName?: string } | undefined;
                            if (contactObj?.displayName) {
                                customerName = contactObj.displayName;
                            }
                        } catch (err) {
                            this.logger.warn(`Could not findOrCreate contact on message arrival: ${(err as Error).message}`);
                        }
                    }

                    // TỰ ĐỘNG ĐỔ DỮ LIỆU KHÁCH HÀNG VÀO DATABASE BẢNG "customers" (cho Kanban & Pipeline)
                    if (!isOutbound && this.prisma && event.senderExternalId) {
                        try {
                            const raw = (event.rawPayload as any) || {};
                            if (raw.customerName) customerName = raw.customerName;
                            if (raw.customerAvatar) customerAvatar = raw.customerAvatar;

                            dbCustomer = await this.prisma.customer.findFirst({
                                where: {
                                    OR: [
                                        { channelIdentities: { path: [event.channel.toLowerCase()], equals: event.senderExternalId } },
                                        { channelIdentities: { path: [event.channel.toLowerCase(), 'id'], equals: event.senderExternalId } },
                                        { channelIdentities: { path: ['socialId'], equals: event.senderExternalId } },
                                        ...(customerName && !customerName.startsWith('Khách hàng') && !customerName.startsWith('Lead') ? [{ fullName: customerName }] : []),
                                    ],
                                },
                            });

                            if (!dbCustomer) {
                                const rawTags: string[] = Array.isArray(raw.tags) && raw.tags.length > 0
                                    ? raw.tags
                                    : (event.channel === Channel.FACEBOOK ? [META_SOURCE_TAGS.FACEBOOK_LEAD] : [CRM_SYSTEM_TAGS.NEW_CUSTOMER]);
                                const tagResult = resolveTagMappings({
                                    channel: event.channel,
                                    currentTags: [],
                                    sourceTags: rawTags,
                                    eventTimestamp: event.sentAt,
                                });

                                dbCustomer = await this.prisma.customer.create({
                                    data: {
                                        workspaceId: event.workspaceId || null,
                                        fullName: customerName,
                                        avatarUrl: customerAvatar,
                                        leadStatus: tagResult.suggestedLeadStatus || 'NEW',
                                        leadStage: tagResult.suggestedLeadStage || 'STAGE_NEW',
                                        channelIdentities: {
                                            [event.channel.toLowerCase()]: event.senderExternalId,
                                            channel: event.channel,
                                            tags: tagResult.finalTags,
                                        },
                                    },
                                });
                                isNewlyCreated = true;
                                this.logger.log(`Tự động lưu khách hàng mới từ Webhook vào DB: "${customerName}" (${dbCustomer.id}) với tag: ${tagResult.finalTags.join(', ')}`);
                            } else {
                                // Nếu khách hàng đã tồn tại trong DB, bảo lưu tên thật và avatar thật
                                if (dbCustomer.fullName && !dbCustomer.fullName.startsWith('Khách hàng')) {
                                    customerName = dbCustomer.fullName;
                                }
                                if (dbCustomer.avatarUrl) {
                                    customerAvatar = dbCustomer.avatarUrl;
                                }

                                const existingIdentities = (dbCustomer.channelIdentities as any) || {};
                                const currentTags: string[] = Array.isArray(existingIdentities.tags) ? existingIdentities.tags : [];
                                const rawTags: string[] = Array.isArray(raw.tags) && raw.tags.length > 0
                                    ? raw.tags
                                    : (event.channel === Channel.FACEBOOK ? [META_SOURCE_TAGS.FACEBOOK_LEAD] : []);

                                const manuallyRemovedTags: string[] = Array.isArray(existingIdentities.manuallyRemovedTags)
                                    ? existingIdentities.manuallyRemovedTags
                                    : [];

                                const tagResult = resolveTagMappings({
                                    channel: event.channel,
                                    currentTags,
                                    sourceTags: rawTags,
                                    existingLeadStatus: dbCustomer.leadStatus,
                                    existingLeadStage: dbCustomer.leadStage,
                                    eventTimestamp: event.sentAt,
                                    lastSyncTimestamp: dbCustomer.updatedAt,
                                    explicitEmptyLabels: Array.isArray(raw.tags) && raw.tags.length === 0,
                                    manuallyRemovedTags,
                                });

                                // Chỉ cập nhật nếu có thay đổi tag hoặc nâng cấp trạng thái hợp lệ (chống hạ cấp khi out-of-order)
                                if (tagResult.hasChanges || tagResult.shouldUpgradeLead) {
                                    const updateData: any = {
                                        channelIdentities: {
                                            ...existingIdentities,
                                            [event.channel.toLowerCase()]: event.senderExternalId,
                                            channel: event.channel,
                                            tags: tagResult.finalTags,
                                        },
                                    };
                                    if (tagResult.shouldUpgradeLead) {
                                        if (tagResult.suggestedLeadStatus) updateData.leadStatus = tagResult.suggestedLeadStatus;
                                        if (tagResult.suggestedLeadStage) updateData.leadStage = tagResult.suggestedLeadStage;
                                    }

                                    dbCustomer = await this.prisma.customer.update({
                                        where: { id: dbCustomer.id },
                                        data: updateData,
                                    });
                                }
                            }
                        } catch (err) {
                            this.logger.warn(`Could not sync webhook customer to DB: ${(err as Error).message}`);
                            tagSyncLogger.logError({
                                stage: TAG_SYNC_STAGE.UPDATE,
                                errorType: TAG_SYNC_ERROR_TYPE.TAG_UPDATE_ERROR,
                                message: `Không thể đồng bộ hoặc cập nhật nhãn khách hàng từ webhook vào CSDL: ${(err as Error).message}`,
                                eventSource: TAG_EVENT_SOURCE.META_WEBHOOK,
                                channel: event.channel,
                                error: err,
                                customerId: dbCustomer?.id,
                                senderExternalId: event.senderExternalId,
                                metadata: {
                                    conversationId,
                                    messageId: item.id,
                                },
                            });
                        }
                    }

                    this.realtime.broadcastNewMessage({
                        id: item.id,
                        conversationId,
                        channel: event.channel as any,
                        direction: (event.direction as any) || 'INBOUND',
                        content: event.content || (isOutbound ? 'Tin nhắn gửi đi từ Page' : 'Tin nhắn mới'),
                        senderName: customerName,
                        senderAvatar: customerAvatar,
                        sentAt: new Date(event.sentAt).toISOString(),
                    });

                    // Chỉ báo cho Kanban cập nhật ứng viên khi tạo mới khách hàng (tránh reset giai đoạn khách hàng cũ)
                    if (isNewlyCreated && dbCustomer) {
                        this.realtime.broadcastPipelineChange({
                            customerId: dbCustomer.id,
                            customerName: customerName,
                            previousStage: '',
                            newStage: dbCustomer.leadStage || 'STAGE_NEW',
                            updatedBy: `Webhook ${event.channel}`,
                        });
                    }
                }
            }
        }

        try {
            await this.queue.enqueue(created.map((m) => m.id));
        } catch (err) {
            this.logger.error('enqueue failed, sweeper will retry', err as Error);
        }
    }
}
