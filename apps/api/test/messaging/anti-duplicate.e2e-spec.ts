import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageRepository } from '../../src/modules/messaging/infrastructure/message.repository.js';
import { ReceiveInboundMessage } from '../../src/modules/messaging/application/receive-inbound-message.usecase.js';
import { ChannelAdapterRegistry } from '../../src/modules/messaging/application/channel-adapter.registry.js';
import { Channel } from '../../src/modules/messaging/domain/channel.js';
import type { ChannelAdapter, InboundMessageQueue, RawWebhookRequest } from '../../src/modules/messaging/domain/channel-adapter.port.js';
import type { InboundEvent } from '../../src/modules/messaging/domain/inbound-event.js';
import { MessageDirection } from '../../src/modules/messaging/domain/channel.js';
import type { PrismaService } from '../../src/platform/database/prisma.service.js';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/recruitment_crm?schema=public';

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

describe('Anti-duplicate: ON CONFLICT DO NOTHING on UNIQUE constraint', () => {
    let messageRepo: MessageRepository;
    let mockQueue: InboundMessageQueue;
    let mockAdapter: ChannelAdapter;
    let registry: ChannelAdapterRegistry;
    let useCase: ReceiveInboundMessage;

    beforeEach(async () => {
        // Dọn dẹp dữ liệu trước mỗi bài test
        await prisma.message.deleteMany();
        await prisma.channelAccount.deleteMany();

        messageRepo = new MessageRepository(prisma as unknown as PrismaService);

        mockQueue = {
            enqueue: vi.fn().mockResolvedValue(undefined),
        };

        mockAdapter = {
            channel: Channel.ZALO,
            verifyRequest: vi.fn().mockReturnValue(true),
            parseEvents: vi.fn(),
        };

        registry = new ChannelAdapterRegistry([mockAdapter]);
        useCase = new ReceiveInboundMessage(registry, messageRepo, mockQueue);
    });

    afterAll(async () => {
        await prisma.message.deleteMany();
        await prisma.channelAccount.deleteMany();
        await prisma.$disconnect();
        await pool.end();
    });

    const createSampleEvent = (externalMessageId = 'msg-duplicate-001'): InboundEvent => ({
        channel: Channel.ZALO,
        externalAccountId: 'oa-cần-thơ-01',
        externalMessageId,
        senderExternalId: 'user-zalo-888',
        direction: MessageDirection.INBOUND,
        content: 'Tư vấn học phí lập trình Java',
        sentAt: new Date('2026-10-23T10:00:00.000Z'),
        rawPayload: { text: 'Tư vấn học phí lập trình Java' },
    });

    it('gửi cùng một sự kiện 10 lần vẫn chỉ có 1 dòng trong DB và 1 job được enqueue', async () => {
        const sampleEvent = createSampleEvent('msg-duplicate-10-times');
        vi.mocked(mockAdapter.parseEvents).mockReturnValue([sampleEvent]);

        const fakeRequest: RawWebhookRequest & { channel: Channel } = {
            channel: Channel.ZALO,
            headers: {},
            rawBody: Buffer.from(JSON.stringify({ events: [sampleEvent] })),
        };

        // Gửi cùng một sự kiện 10 lần liên tiếp
        for (let i = 0; i < 10; i++) {
            await useCase.execute(fakeRequest);
        }

        // 1. Kiểm tra Database: Chỉ có ĐÚNG 1 dòng tin nhắn được lưu
        const messagesInDb = await prisma.message.findMany({
            where: {
                channel: Channel.ZALO,
                externalMessageId: 'msg-duplicate-10-times',
            },
        });
        expect(messagesInDb).toHaveLength(1);
        expect(messagesInDb[0].content).toBe('Tư vấn học phí lập trình Java');

        // 2. Kiểm tra Queue: enqueue chỉ được gọi ĐÚNG 1 lần tạo 1 job duy nhất
        expect(mockQueue.enqueue).toHaveBeenCalledTimes(1);
        expect(mockQueue.enqueue).toHaveBeenCalledWith([messagesInDb[0].id]);
    });

    it('gửi một batch chứa 10 sự kiện trùng nhau trong cùng 1 request cũng chỉ tạo 1 dòng và 1 job', async () => {
        const sampleEvent = createSampleEvent('msg-batch-duplicate');
        // Batch gồm 10 sự kiện giống hệt nhau
        const duplicateBatch = Array.from({ length: 10 }, () => ({ ...sampleEvent }));
        vi.mocked(mockAdapter.parseEvents).mockReturnValue(duplicateBatch);

        const fakeRequest: RawWebhookRequest & { channel: Channel } = {
            channel: Channel.ZALO,
            headers: {},
            rawBody: Buffer.from(JSON.stringify({ events: duplicateBatch })),
        };

        await useCase.execute(fakeRequest);

        // 1. Kiểm tra Database
        const messagesInDb = await prisma.message.findMany({
            where: {
                channel: Channel.ZALO,
                externalMessageId: 'msg-batch-duplicate',
            },
        });
        expect(messagesInDb).toHaveLength(1);

        // 2. Kiểm tra Queue
        expect(mockQueue.enqueue).toHaveBeenCalledTimes(1);
        expect(mockQueue.enqueue).toHaveBeenCalledWith([messagesInDb[0].id]);
    });
});
