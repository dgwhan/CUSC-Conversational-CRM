import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { ReceiveInboundMessage } from '../../src/modules/messaging/application/receive-inbound-message.usecase.js';
import { ChannelAdapterRegistry } from '../../src/modules/messaging/application/channel-adapter.registry.js';
import { Channel, MessageDirection } from '../../src/modules/messaging/domain/channel.js';
import type { ChannelAdapter, InboundMessageQueue, RawWebhookRequest } from '../../src/modules/messaging/domain/channel-adapter.port.js';
import type { MessageRepository } from '../../src/modules/messaging/infrastructure/message.repository.js';
import type { InboundEvent } from '../../src/modules/messaging/domain/inbound-event.js';

describe('ReceiveInboundMessage UseCase', () => {
    let useCase: ReceiveInboundMessage;
    let registry: ChannelAdapterRegistry;
    let mockAdapter: ChannelAdapter;
    let mockRepo: Partial<MessageRepository>;
    let mockQueue: InboundMessageQueue;

    beforeEach(() => {
        mockAdapter = {
            channel: Channel.ZALO,
            verifyRequest: vi.fn(),
            parseEvents: vi.fn(),
        };

        registry = new ChannelAdapterRegistry([mockAdapter]);

        mockRepo = {
            insertManyIgnoreDuplicate: vi.fn().mockResolvedValue([{ id: 'msg-uuid-1' }]),
        };

        mockQueue = {
            enqueue: vi.fn().mockResolvedValue(undefined),
        };

        useCase = new ReceiveInboundMessage(
            registry,
            mockRepo as MessageRepository,
            mockQueue,
        );
    });

    it('throws UnauthorizedException if signature verification fails', async () => {
        vi.mocked(mockAdapter.verifyRequest).mockReturnValue(false);

        const req: RawWebhookRequest & { channel: Channel } = {
            channel: Channel.ZALO,
            headers: {},
            rawBody: Buffer.from('test'),
        };

        await expect(useCase.execute(req)).rejects.toThrow(UnauthorizedException);
    });

    it('successfully processes valid webhook, inserts messages, and enqueues ids', async () => {
        vi.mocked(mockAdapter.verifyRequest).mockReturnValue(true);

        const event: InboundEvent = {
            channel: Channel.ZALO,
            externalAccountId: 'oa-1',
            externalMessageId: 'ext-1',
            senderExternalId: 'sender-1',
            direction: MessageDirection.INBOUND,
            content: 'Hello World',
            sentAt: new Date(),
            rawPayload: {},
        };

        vi.mocked(mockAdapter.parseEvents).mockReturnValue([event]);

        const req: RawWebhookRequest & { channel: Channel } = {
            channel: Channel.ZALO,
            headers: {},
            rawBody: Buffer.from('test'),
        };

        await useCase.execute(req);

        expect(mockRepo.insertManyIgnoreDuplicate).toHaveBeenCalledWith([event]);
        expect(mockQueue.enqueue).toHaveBeenCalledWith(['msg-uuid-1']);
    });

    it('does not enqueue if no events parsed', async () => {
        vi.mocked(mockAdapter.verifyRequest).mockReturnValue(true);
        vi.mocked(mockAdapter.parseEvents).mockReturnValue([]);

        const req: RawWebhookRequest & { channel: Channel } = {
            channel: Channel.ZALO,
            headers: {},
            rawBody: Buffer.from('test'),
        };

        await useCase.execute(req);

        expect(mockRepo.insertManyIgnoreDuplicate).not.toHaveBeenCalled();
        expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });
});
