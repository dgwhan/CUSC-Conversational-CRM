import { ChannelAdapter, InvalidWebhookPayloadError, RawWebhookRequest } from "../../src/modules/messaging/domain/channel-adapter.port.js";
import { MessageDirection } from "../../src/modules/messaging/domain/channel.js";
import { Channel } from "../../src/modules/messaging/domain/channel.js";
import { createHmac, timingSafeEqual } from 'node:crypto';
import { InboundEvent } from "../../src/modules/messaging/domain/inbound-event.js";

export const FAKE_SIGNATURE_HEADER = 'x-fake-signature';

export type FakeWireEvent = {
    account: string;
    messageId: string;
    sender: string;
    text: string | null;
    sentAt: string;
    direction?: MessageDirection;
};

export class FakeChannelAdapter implements ChannelAdapter {
    constructor(readonly channel: Channel = Channel.MANUAL_IMPORT, 
        private readonly secret = 'test-secret') { }

    verifyRequest(request: RawWebhookRequest): boolean {
        const received = request.headers[FAKE_SIGNATURE_HEADER];

        if(!received) return false;
        const sig = Array.isArray(received) ? received[0] : received;
        if (!sig) return false;
        const a = Buffer.from(sig);
        const b = Buffer.from(this.sign(request.rawBody));
        return a.length === b.length && timingSafeEqual(a,b);
    }

    parseEvents(request: RawWebhookRequest): InboundEvent[] {
        let body: { events?: FakeWireEvent[] };
        try {
            body = JSON.parse(request.rawBody.toString('utf-8'));
        } catch {
            throw new InvalidWebhookPayloadError('Body is not valid JSON');
        }

        if(!Array.isArray(body.events)) {
            throw new InvalidWebhookPayloadError('Missing event array');
        }

        return body.events.map((e) => ({
            channel: this.channel,
            externalAccountId: e.account,
            externalMessageId: e.messageId,
            senderExternalId: e.sender,
            direction: e.direction ?? MessageDirection.INBOUND,
            content: e.text,
            sentAt: new Date(e.sentAt),
            rawPayload: e,
        }));
    }

    buildRequest(events: FakeWireEvent[], signature?: string): RawWebhookRequest {
        const rawBody = Buffer.from(JSON.stringify({events}));

        return {
            headers: { [FAKE_SIGNATURE_HEADER]: signature ?? this.sign(rawBody)},
            rawBody,
        };
    }

    private sign(body: Buffer): string {
        return createHmac('sha256', this.secret).update(body).digest('hex');
    }
};

