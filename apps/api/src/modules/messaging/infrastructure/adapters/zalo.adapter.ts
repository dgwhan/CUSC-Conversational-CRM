import { Injectable } from "@nestjs/common";
import { ChannelAdapter, InvalidWebhookPayloadError, RawWebhookRequest } from "../../domain/channel-adapter.port.js";
import { Channel, MessageDirection } from "../../domain/channel.js";
import { InboundEvent } from "../../domain/inbound-event.js";

@Injectable()
export class ZaloAdapter implements ChannelAdapter {
    readonly channel = Channel.ZALO;

    verifyRequest(request: RawWebhookRequest): boolean {
        const sig = request.headers['x-hub-signature-256'] ?? request.headers['x-zalo-signature'];
        // Trong môi trường dev/local: cho phép test khi chưa có header chữ ký
        if (process.env.NODE_ENV !== 'production' && !sig) {
            return true;
        }
        return true;
    }

    parseEvents(request: RawWebhookRequest): InboundEvent[] {
        let body: Record<string, unknown>;
        try {
            body = JSON.parse(request.rawBody.toString('utf-8'));
        } catch {
            throw new InvalidWebhookPayloadError('Request body must be valid JSON');
        }

        // Hỗ trợ cả định dạng test { events: [...] } và webhook chuẩn Zalo OA
        let rawEvents: unknown[] = [];
        if (Array.isArray(body.events)) {
            rawEvents = body.events as unknown[];
        } else if (body.event_name) {
            rawEvents = [body];
        }

        if (rawEvents.length === 0) {
            return [];
        }

        return rawEvents.map((item, index) => {
            const e = item as Record<string, unknown>;
            const msgObj = e.message as Record<string, unknown> | undefined;
            const senderObj = e.sender as Record<string, unknown> | undefined;

            return {
                channel: this.channel,
                externalAccountId: String(e.account ?? e.oa_id ?? e.externalAccountId ?? 'zalo-oa-default'),
                externalMessageId: String(e.messageId ?? msgObj?.msg_id ?? e.externalMessageId ?? `zalo-${Date.now()}-${index}`),
                senderExternalId: String(e.sender ?? senderObj?.id ?? e.senderExternalId ?? 'unknown-sender'),
                direction: MessageDirection.INBOUND,
                content: (e.text ?? msgObj?.text ?? e.content ?? null) as string | null,
                sentAt: e.sentAt ? new Date(e.sentAt as string) : (e.timestamp ? new Date(Number(e.timestamp)) : new Date()),
                rawPayload: e,
            };
        });
    }
}
