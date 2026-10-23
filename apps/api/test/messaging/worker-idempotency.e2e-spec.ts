import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageRepository } from '../../src/modules/messaging/infrastructure/message.repository.js';
import { ProcessMessageReceived } from '../../src/modules/messaging/application/process-message-received.usecase.js';
import { Channel, MessageDirection } from '../../src/modules/messaging/domain/channel.js';
import type { CustomerGateway } from '../../src/modules/messaging/domain/customer-gateway.port.js';
import type { ClassificationGateway } from '../../src/modules/messaging/domain/classification-gateway.port.js';
import type { PrismaService } from '../../src/platform/database/prisma.service.js';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/recruitment_crm?schema=public';

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

describe('Worker message.received Idempotency E2E (Tắt bật worker giữa chừng)', () => {
    let messageRepo: MessageRepository;
    let mockCustomer: CustomerGateway;
    let mockClassification: ClassificationGateway;
    let useCase: ProcessMessageReceived;
    let accountId: string;

    beforeEach(async () => {
        await prisma.message.deleteMany();
        await prisma.channelAccount.deleteMany();

        const account = await prisma.channelAccount.create({
            data: {
                channel: Channel.ZALO,
                externalAccountId: 'oa-e2e-worker',
                displayName: 'Zalo OA E2E Worker',
            },
        });
        accountId = account.id;

        messageRepo = new MessageRepository(prisma as unknown as PrismaService);

        mockCustomer = {
            findOrCreate: vi.fn().mockResolvedValue({ id: 'cust-e2e-1', isNew: true }),
        };

        mockClassification = {
            classify: vi.fn().mockResolvedValue({ intent: 'COURSE_INQUIRY', score: 0.98 }),
        };

        useCase = new ProcessMessageReceived(
            messageRepo,
            mockCustomer,
            mockClassification,
        );
    });

    afterAll(async () => {
        await prisma.message.deleteMany();
        await prisma.channelAccount.deleteMany();
        await prisma.$disconnect();
        await pool.end();
    });

    it('tắt worker giữa chừng rồi bật lại: tin không mất và không bị xử lý hai lần', async () => {
        // Tạo tin nhắn mới trong Database thật (processedAt = null)
        const message = await prisma.message.create({
            data: {
                channelAccountId: accountId,
                channel: Channel.ZALO,
                direction: MessageDirection.INBOUND,
                content: 'Hỏi lịch khai giảng lớp Python',
                sentAt: new Date('2026-10-23T09:00:00.000Z'),
                externalMessageId: 'zalo-worker-test-001',
                rawPayload: {
                    sender: 'user-python-seeker',
                    text: 'Hỏi lịch khai giảng lớp Python',
                },
                processedAt: null,
            },
        });

        // ==========================================
        // GIAI ĐOẠN 1: Worker bị tắt/crash giữa chừng
        // Giả lập worker đang gọi classification thì bị ngắt kết nối (process killed)
        // ==========================================
        vi.mocked(mockClassification.classify).mockRejectedValueOnce(new Error('Process terminated / SIGTERM'));

        await expect(useCase.execute(message.id)).rejects.toThrow('Process terminated / SIGTERM');

        // KIỂM TRA: Tin nhắn không hề bị mất, processedAt vẫn là null
        let checkDb = await prisma.message.findUnique({ where: { id: message.id } });
        expect(checkDb).not.toBeNull();
        expect(checkDb?.processedAt).toBeNull();

        // ==========================================
        // GIAI ĐOẠN 2: Worker được bật lại (Job retry)
        // ==========================================
        vi.mocked(mockClassification.classify).mockResolvedValueOnce({ intent: 'COURSE_INQUIRY', score: 0.98 });

        const processResult = await useCase.execute(message.id);
        expect(processResult).toBe(true);

        // KIỂM TRA: Tin nhắn đã được cập nhật processedAt trong Database
        checkDb = await prisma.message.findUnique({ where: { id: message.id } });
        expect(checkDb?.processedAt).not.toBeNull();
        const savedProcessedAt = checkDb!.processedAt!;

        // ==========================================
        // GIAI ĐOẠN 3: Worker tiếp tục nhận lại job hoặc restart lần nữa
        // ==========================================
        const rerunResult = await useCase.execute(message.id);
        expect(rerunResult).toBe(false); // Bị bỏ qua do Idempotency

        // KIỂM TRA:
        // 1. Phân loại chỉ thành công đúng 1 lần (ở giai đoạn 2)
        expect(mockClassification.classify).toHaveBeenCalledTimes(2); // 1 lần fail, 1 lần ok, lần 3 không gọi
        // 2. processedAt không bị ghi đè lại
        const finalDb = await prisma.message.findUnique({ where: { id: message.id } });
        expect(finalDb?.processedAt?.getTime()).toBe(savedProcessedAt.getTime());
    });
});
