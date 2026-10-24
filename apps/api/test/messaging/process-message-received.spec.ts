import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProcessMessageReceived } from '../../src/modules/messaging/application/process-message-received.usecase.js';
import type { MessageRepository } from '../../src/modules/messaging/infrastructure/message.repository.js';
import type { CustomerGateway } from '../../src/modules/messaging/domain/customer-gateway.port.js';
import type { ClassificationGateway } from '../../src/modules/messaging/domain/classification-gateway.port.js';
import { Channel, MessageDirection } from '../../src/modules/messaging/domain/channel.js';
import type { Message } from '@prisma/client';

describe('ProcessMessageReceived UseCase (Worker message.received)', () => {
    let useCase: ProcessMessageReceived;
    let mockRepo: Partial<MessageRepository>;
    let mockCustomer: CustomerGateway;
    let mockClassification: ClassificationGateway;

    const createSampleMessage = (overrides: Partial<Message> = {}): Message => ({
        id: 'msg-uuid-123',
        channelAccountId: 'account-uuid-1',
        channel: Channel.ZALO,
        direction: MessageDirection.INBOUND,
        content: 'Tư vấn khóa học Frontend React',
        sentAt: new Date('2026-10-23T08:00:00.000Z'),
        externalMessageId: 'ext-zalo-msg-999',
        rawPayload: {
            sender: 'user-zalo-101',
            text: 'Tư vấn khóa học Frontend React',
        },
        processedAt: null,
        createdAt: new Date('2026-10-23T08:00:01.000Z'),
        ...overrides,
    });

    beforeEach(() => {
        mockRepo = {
            findById: vi.fn(),
            markProcessed: vi.fn().mockResolvedValue(undefined),
        };

        mockCustomer = {
            findOrCreate: vi.fn().mockResolvedValue({ id: 'cust-uuid-001', isNew: true }),
        };

        mockClassification = {
            classify: vi.fn().mockResolvedValue({ intent: 'COURSE_INQUIRY', confidence: 0.95 }),
        };

        useCase = new ProcessMessageReceived(
            mockRepo as MessageRepository,
            mockCustomer,
            mockClassification,
        );
    });

    it('xử lý tin nhắn mới: tìm hoặc tạo khách, gọi classification, đặt processed_at', async () => {
        const message = createSampleMessage();
        vi.mocked(mockRepo.findById!).mockResolvedValue(message);

        const result = await useCase.execute(message.id);

        expect(result).toBe(true);
        // 1. Tìm hoặc tạo khách
        expect(mockCustomer.findOrCreate).toHaveBeenCalledWith({
            channel: Channel.ZALO,
            senderExternalId: 'user-zalo-101',
            rawPayload: message.rawPayload,
        });

        // 2. Gọi phân loại
        expect(mockClassification.classify).toHaveBeenCalledWith({
            messageId: message.id,
            content: 'Tư vấn khóa học Frontend React',
            customerId: 'cust-uuid-001',
        });

        // 3. Đặt processed_at = now()
        expect(mockRepo.markProcessed).toHaveBeenCalledWith(message.id, expect.any(Date));
    });

    it('chống xử lý hai lần (Idempotency): nếu tin đã có processed_at, worker bỏ qua ngay lập tức', async () => {
        // Giả lập tin nhắn ĐÃ được xử lý trước đó (processedAt khác null)
        const alreadyProcessedMessage = createSampleMessage({
            processedAt: new Date('2026-10-23T08:05:00.000Z'),
        });
        vi.mocked(mockRepo.findById!).mockResolvedValue(alreadyProcessedMessage);

        const result = await useCase.execute(alreadyProcessedMessage.id);

        expect(result).toBe(false);
        // KHÔNG tìm/tạo khách lại
        expect(mockCustomer.findOrCreate).not.toHaveBeenCalled();
        // KHÔNG gọi classification lại
        expect(mockClassification.classify).not.toHaveBeenCalled();
        // KHÔNG cập nhật lại processedAt
        expect(mockRepo.markProcessed).not.toHaveBeenCalled();
    });

    it('khi gặp lỗi: ném lỗi ra ngoài để BullMQ worker kích hoạt retry, không đặt processed_at (tin không mất)', async () => {
        const message = createSampleMessage();
        vi.mocked(mockRepo.findById!).mockResolvedValue(message);

        // Giả lập classification service bị timeout / lỗi kết nối
        vi.mocked(mockClassification.classify).mockRejectedValue(new Error('AI Classification Service Timeout'));

        await expect(useCase.execute(message.id)).rejects.toThrow('AI Classification Service Timeout');

        // Chưa đặt processed_at khi gặp lỗi để lần retry tiếp theo xử lý lại
        expect(mockRepo.markProcessed).not.toHaveBeenCalled();
    });

    it('kịch bản: worker chết giữa chừng rồi bật lại -> tin không mất và không bị xử lý hai lần', async () => {
        let currentMessage = createSampleMessage();
        vi.mocked(mockRepo.findById!).mockImplementation(async () => currentMessage);
        vi.mocked(mockRepo.markProcessed!).mockImplementation(async (_id, date) => {
            currentMessage = { ...currentMessage, processedAt: date ?? new Date() };
        });

        // Lần 1: Worker đang chạy thì bị crash/lỗi ở bước phân loại (tắt worker giữa chừng)
        vi.mocked(mockClassification.classify).mockRejectedValueOnce(new Error('Worker killed abruptly'));
        await expect(useCase.execute(currentMessage.id)).rejects.toThrow('Worker killed abruptly');
        expect(currentMessage.processedAt).toBeNull(); // Tin vẫn nguyên trong DB, không mất

        // Lần 2: Worker được bật lại (retry job) -> Chạy thành công
        vi.mocked(mockClassification.classify).mockResolvedValueOnce({ intent: 'COURSE_INQUIRY' });
        const res2 = await useCase.execute(currentMessage.id);
        expect(res2).toBe(true);
        expect(currentMessage.processedAt).not.toBeNull(); // Đã đánh dấu hoàn tất

        // Lần 3: Job bị phát lại hoặc worker restart lại sau khi đã xong -> Không bị xử lý lần hai
        const res3 = await useCase.execute(currentMessage.id);
        expect(res3).toBe(false);

        // Tổng cộng findOrCreate chỉ xử lý thành công 1 lần ở Lần 2 (và 1 lần thử ở Lần 1)
        expect(mockRepo.markProcessed).toHaveBeenCalledTimes(1);
    });
});
