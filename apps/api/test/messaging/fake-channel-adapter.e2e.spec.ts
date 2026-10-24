import { ChannelAdapter, InvalidWebhookPayloadError } from "../../src/modules/messaging/domain/channel-adapter.port.js";
import { FakeChannelAdapter, FakeWireEvent } from "../support/fake-channel-adapter.js";

const event = (over: Partial<FakeWireEvent> = {}): FakeWireEvent => ({
    account: 'oa-1',
    messageId: 'msg-001',
    sender: 'user-9',
    text: 'How much is the tuition for the Java course?',
    sentAt: '2026-10-21T09:00:00.000Z',
    ...over,
});

describe('FakeChannelAdapter (as ChannelAdapter)', () => {
    const adapter: ChannelAdapter = new FakeChannelAdapter();
    const fake = new FakeChannelAdapter();

    it('accepts a correctly signed request', () => {
        expect(adapter.verifyRequest(fake.buildRequest([event()]))).toBe(true);
    });

    it('rejects a wrong or missing signature', () => {
        expect(adapter.verifyRequest(fake.buildRequest([event()], 'bad'))).toBe(false);
        expect(adapter.verifyRequest({headers: {}, rawBody: Buffer.from('{}') })).toBe(false);
    });

    it('rejects a tampered body', () => {
        const req = fake.buildRequest([event()]);
        const tampered = { ...req, rawBody: Buffer.from(JSON.stringify({events: [event({ text: 'hack'})]}))};
        expect(adapter.verifyRequest(tampered)).toBe(false);
    });

    it('parse every event in one request into InboundEvents', () => {
        const events = adapter.parseEvents(
            fake.buildRequest([event(), event({messageId: 'msg-002', text: null})])
        );

        expect(events[0]!.sentAt).toEqual(new Date('2026-10-21T09:00:00.000Z'));
        expect(events[1]!.content).toBeNull();
    });

    it('throws InvalidWebhookPayloadError on malformed payload', () => {
        const bad = { headers: {}, rawBody: Buffer.from('not json')};
        expect(() => adapter.parseEvents(bad)).toThrow(InvalidWebhookPayloadError);
    });
})