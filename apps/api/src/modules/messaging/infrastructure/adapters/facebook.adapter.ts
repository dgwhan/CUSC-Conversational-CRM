import { Injectable } from "@nestjs/common";
import { ChannelAdapter, InvalidWebhookPayloadError, RawWebhookRequest } from "../../domain/channel-adapter.port.js";
import { Channel, MessageDirection } from "../../domain/channel.js";
import { InboundEvent } from "../../domain/inbound-event.js";

@Injectable()
export class FacebookAdapter implements ChannelAdapter {
    readonly channel = Channel.FACEBOOK;

    verifyRequest(request: RawWebhookRequest): boolean {
        const sig = request.headers['x-hub-signature-256'];
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

        // Hỗ trợ format test { events: [...] }
        if (Array.isArray(body.events)) {
            return (body.events as unknown[]).map((item, index) => {
                const e = item as Record<string, unknown>;
                return {
                    channel: this.channel,
                    externalAccountId: String(e.account ?? e.externalAccountId ?? 'fb-page-default'),
                    externalMessageId: String(e.messageId ?? e.externalMessageId ?? `fb-${Date.now()}-${index}`),
                    senderExternalId: String(e.sender ?? e.senderExternalId ?? 'unknown-sender'),
                    direction: MessageDirection.INBOUND,
                    content: (e.text ?? e.content ?? null) as string | null,
                    sentAt: e.sentAt ? new Date(e.sentAt as string) : new Date(),
                    rawPayload: e,
                };
            });
        }

        // Hỗ trợ format webhook chính thức của Meta (object: 'page')
        if (body.object === 'page' && Array.isArray(body.entry)) {
            const events: InboundEvent[] = [];
            for (const entry of body.entry as Array<Record<string, unknown>>) {
                const pageId = entry.id;
                const messagingList = (entry.messaging ?? []) as Array<Record<string, unknown>>;
                for (const messaging of messagingList) {
                    const message = messaging.message as Record<string, unknown> | undefined;
                    const sender = messaging.sender as Record<string, unknown> | undefined;
                    if (message && message.mid) {
                        events.push({
                            channel: this.channel,
                            externalAccountId: String(pageId ?? 'fb-page-default'),
                            externalMessageId: String(message.mid),
                            senderExternalId: String(sender?.id ?? 'unknown-sender'),
                            direction: MessageDirection.INBOUND,
                            content: (message.text ?? null) as string | null,
                            sentAt: new Date(Number(messaging.timestamp ?? Date.now())),
                            rawPayload: messaging,
                        });
                    }
                }
            }
            return events;
        }

        return [];
    }
}
