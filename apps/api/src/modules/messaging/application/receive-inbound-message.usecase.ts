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
                                    channelIdentities: { path: [event.channel.toLowerCase()], equals: event.senderExternalId },
                                },
                            });

                            if (!dbCustomer) {
                                dbCustomer = await this.prisma.customer.create({
                                    data: {
                                        workspaceId: event.workspaceId || null,
                                        fullName: customerName,
                                        avatarUrl: customerAvatar,
                                        leadStatus: 'NEW',
                                        leadStage: 'STAGE_NEW',
                                        channelIdentities: { [event.channel.toLowerCase()]: event.senderExternalId, channel: event.channel },
                                    },
                                });
                                this.logger.log(`Tự động lưu khách hàng mới từ Webhook vào DB: "${customerName}" (${dbCustomer.id})`);
                            } else {
                                // Nếu khách hàng đã tồn tại trong DB (ví dụ từ sync), ưu tiên lấy tên thật và avatar thật
                                if (dbCustomer.fullName && !dbCustomer.fullName.startsWith('Khách hàng')) {
                                    customerName = dbCustomer.fullName;
                                }
                                if (dbCustomer.avatarUrl) {
                                    customerAvatar = dbCustomer.avatarUrl;
                                }
                            }
                        } catch (err) {
                            this.logger.warn(`Could not sync webhook customer to DB: ${(err as Error).message}`);
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

                    // Tự động báo cho Kanban cập nhật ứng viên mới
                    if (dbCustomer) {
                        this.realtime.broadcastPipelineChange({
                            customerId: dbCustomer.id,
                            customerName: customerName,
                            previousStage: '',
                            newStage: 'STAGE_NEW',
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
