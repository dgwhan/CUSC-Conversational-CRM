import { Injectable } from "@nestjs/common";
import { ChannelAdapter, InvalidWebhookPayloadError, RawWebhookRequest } from "../../domain/channel-adapter.port.js";
import { Channel, MessageDirection } from "../../domain/channel.js";
import { InboundEvent } from "../../domain/inbound-event.js";

@Injectable()
export class ManualImportAdapter implements ChannelAdapter {
    readonly channel = Channel.MANUAL_IMPORT;

    verifyRequest(_request: RawWebhookRequest): boolean {
        // Import thủ công không yêu cầu xác thực chữ ký HMAC
        return true;
    }

    parseEvents(request: RawWebhookRequest): InboundEvent[] {
        let body: Record<string, unknown>;
        try {
            body = JSON.parse(request.rawBody.toString('utf-8'));
        } catch {
            throw new InvalidWebhookPayloadError('Request body must be valid JSON');
        }

        const events = Array.isArray(body) ? body : (body?.events as unknown[]);
        if (!Array.isArray(events)) {
            throw new InvalidWebhookPayloadError('Missing events array in payload');
        }

        return events.map((item, index) => {
            const e = item as Record<string, unknown>;
            return {
                channel: this.channel,
                externalAccountId: String(e.account ?? e.externalAccountId ?? 'manual-account'),
                externalMessageId: String(e.messageId ?? e.externalMessageId ?? `manual-${Date.now()}-${index}`),
                senderExternalId: String(e.sender ?? e.senderExternalId ?? 'unknown-sender'),
                direction: (e.direction as MessageDirection) ?? MessageDirection.INBOUND,
                content: (e.text ?? e.content ?? null) as string | null,
                sentAt: e.sentAt ? new Date(e.sentAt as string) : new Date(),
                rawPayload: e,
            };
        });
    }
}
