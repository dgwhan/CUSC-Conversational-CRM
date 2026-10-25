import { Inject, Injectable, Logger, Optional, UnauthorizedException } from "@nestjs/common";
import { INBOUND_QUEUE } from "../domain/channel-adapter.port.js";
import type { InboundMessageQueue, RawWebhookRequest } from "../domain/channel-adapter.port.js";
import { Channel } from "../domain/channel.js";
import type { InboundEvent } from "../domain/inbound-event.js";
import { ChannelAdapterRegistry } from "./channel-adapter.registry.js";
import { MessageRepository } from "../infrastructure/message.repository.js";
import { RealtimeService } from "../../realtime/realtime.service.js";

@Injectable()
export class ReceiveInboundMessage {
    private readonly logger = new Logger(ReceiveInboundMessage.name);

    constructor(
        private readonly adapters: ChannelAdapterRegistry,
        private readonly messages: MessageRepository,
        @Inject(INBOUND_QUEUE) private readonly queue: InboundMessageQueue,
        @Optional() private readonly realtime?: RealtimeService,
    ) {}

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
                    // Tạo conversationId theo ngữ cảnh tài khoản và người gửi thực tế thay vì gán cứng
                    const conversationId = event.externalAccountId && event.senderExternalId
                        ? `${event.channel}_${event.externalAccountId}_${event.senderExternalId}`
                        : `conv_${item.id}`;

                    this.realtime.broadcastNewMessage({
                        id: item.id,
                        conversationId,
                        channel: event.channel as any,
                        direction: (event.direction as any) || 'INBOUND',
                        content: event.content || (isOutbound ? 'Tin nhắn gửi đi từ Page' : 'Tin nhắn mới'),
                        senderName: isOutbound
                            ? 'Trang (Page Meta)'
                            : `Khách hàng (${event.senderExternalId || event.channel})`,
                        sentAt: new Date(event.sentAt).toLocaleTimeString(),
                    });
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
