import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ImportMessagesUseCase } from '../../src/modules/messaging/application/import-messages.usecase.js';
import type { MessageRepository } from '../../src/modules/messaging/infrastructure/message.repository.js';
import type { InboundMessageQueue } from '../../src/modules/messaging/domain/channel-adapter.port.js';

describe('ImportMessagesUseCase (MSG-06)', () => {
    let useCase: ImportMessagesUseCase;
    let mockRepo: Partial<MessageRepository>;
    let mockQueue: InboundMessageQueue;

    beforeEach(() => {
        mockRepo = {
            insertManyIgnoreDuplicate: vi.fn().mockImplementation(async (events) => {
                return events.map((_: unknown, i: number) => ({ id: `imported-uuid-${i + 1}` }));
            }),
        };

        mockQueue = {
            enqueue: vi.fn().mockResolvedValue(undefined),
        };

        useCase = new ImportMessagesUseCase(mockRepo as MessageRepository, mockQueue);
    });

    it('nhập tay dữ liệu hợp lệ thành công và đưa vào queue', async () => {
        const result = await useCase.execute({
            type: 'manual',
            items: [
                {
                    kênh: 'ZALO',
                    'người gửi': '0901234567',
                    'nội dung': 'Em muốn tìm hiểu học phí',
                    'thời gian': '2026-10-24T10:00:00Z',
                },
                {
                    channel: 'FACEBOOK',
                    sender: 'fb_candidate_01',
                    content: 'Tư vấn giúp mình nhé',
                    sentAt: '2026-10-24T10:15:00Z',
                },
            ],
        });

        expect(result.total).toBe(2);
        expect(result.successCount).toBe(2);
        expect(result.errorCount).toBe(0);
        expect(result.errors).toHaveLength(0);
        expect(result.importedIds).toHaveLength(2);
        expect(mockRepo.insertManyIgnoreDuplicate).toHaveBeenCalledTimes(1);
        expect(mockQueue.enqueue).toHaveBeenCalledWith(['imported-uuid-1', 'imported-uuid-2']);
    });

    it('báo từng dòng lỗi khi kênh không hợp lệ, người gửi để trống hoặc thời gian sai định dạng', async () => {
        const result = await useCase.execute({
            type: 'manual',
            items: [
                {
                    // Dòng 1: Kênh sai
                    kênh: 'TELEGRAM_INVALID',
                    'người gửi': 'user1',
                    'nội dung': 'Tin nhắn 1',
                    'thời gian': '2026-10-24T10:00:00Z',
                },
                {
                    // Dòng 2: Người gửi rỗng
                    kênh: 'ZALO',
                    'người gửi': '   ',
                    'nội dung': 'Tin nhắn 2',
                    'thời gian': '2026-10-24T10:00:00Z',
                },
                {
                    // Dòng 3: Thời gian sai định dạng
                    kênh: 'TIKTOK',
                    'người gửi': 'user3',
                    'nội dung': 'Tin nhắn 3',
                    'thời gian': 'ngày-mai-luc-10-gio',
                },
                {
                    // Dòng 4: Hợp lệ
                    kênh: 'MANUAL_IMPORT',
                    'người gửi': 'user4',
                    'nội dung': 'Hợp lệ',
                    'thời gian': '2026-10-24T11:00:00Z',
                },
            ],
        });

        expect(result.total).toBe(4);
        expect(result.successCount).toBe(1);
        expect(result.errorCount).toBe(3);

        // Kiểm tra báo từng dòng lỗi với số dòng và lý do rõ ràng
        expect(result.errors).toEqual([
            expect.objectContaining({
                row: 1,
                reason: expect.stringContaining('Kênh không hợp lệ'),
            }),
            expect.objectContaining({
                row: 2,
                reason: expect.stringContaining('Người gửi không được để trống'),
            }),
            expect.objectContaining({
                row: 3,
                reason: expect.stringContaining('Thời gian không đúng định dạng'),
            }),
        ]);

        expect(result.importedIds).toHaveLength(1);
    });

    it('import qua CSV phân tích đúng dữ liệu và bắt lỗi theo dòng', async () => {
        const csv = [
            'kênh,người gửi,nội dung,thời gian',
            'ZALO,0911222333,Em muốn học lập trình,2026-10-24T08:00:00Z',
            'UNKNOWN_CHANNEL,test_sender,Lỗi kênh,2026-10-24T08:05:00Z',
            'FACEBOOK,,Thiếu người gửi,2026-10-24T08:10:00Z',
        ].join('\n');

        const result = await useCase.execute({
            type: 'csv',
            csvContent: csv,
        });

        expect(result.total).toBe(3);
        expect(result.successCount).toBe(1);
        expect(result.errorCount).toBe(2);

        expect(result.errors).toEqual([
            expect.objectContaining({
                row: 2,
                csvLine: 3,
                reason: expect.stringContaining('Kênh không hợp lệ'),
            }),
            expect.objectContaining({
                row: 3,
                csvLine: 4,
                reason: expect.stringContaining('Người gửi không được để trống'),
            }),
        ]);
    });

    /**
     * Tiêu chuẩn chấp thuận (DoD):
     * "Xong khi: import 100 dòng, dòng lỗi được liệt kê rõ số dòng và lý do"
     */
    it('DoD: import 100 dòng, các dòng lỗi được liệt kê rõ số dòng và lý do cụ thể', async () => {
        // Tạo bộ dữ liệu 100 dòng với một số dòng bị lỗi tại các vị trí xác định
        const totalRows = 100;
        const invalidRowMap = new Map<number, { errorField: string; reasonKeyword: string }>([
            [5, { errorField: 'channel', reasonKeyword: 'Kênh không hợp lệ' }],
            [18, { errorField: 'sender', reasonKeyword: 'Người gửi không được để trống' }],
            [35, { errorField: 'sentAt', reasonKeyword: 'Thời gian không đúng định dạng' }],
            [50, { errorField: 'channel', reasonKeyword: 'Kênh không hợp lệ' }],
            [72, { errorField: 'sender', reasonKeyword: 'Người gửi không được để trống' }],
            [89, { errorField: 'sentAt', reasonKeyword: 'Thời gian không đúng định dạng' }],
            [100, { errorField: 'all', reasonKeyword: 'Kênh không hợp lệ' }],
        ]);

        const csvLines = ['kênh,người gửi,nội dung,thời gian'];

        for (let i = 1; i <= totalRows; i++) {
            if (invalidRowMap.has(i)) {
                const config = invalidRowMap.get(i)!;
                if (config.errorField === 'channel') {
                    csvLines.push(`INVALID_CHANNEL_${i},candidate_${i},Nội dung kiểm thử,2026-10-24T09:00:00Z`);
                } else if (config.errorField === 'sender') {
                    csvLines.push(`ZALO,,Nội dung kiểm thử không có người gửi,2026-10-24T09:00:00Z`);
                } else if (config.errorField === 'sentAt') {
                    csvLines.push(`FACEBOOK,candidate_${i},Nội dung kiểm thử,invalid_timestamp_value`);
                } else {
                    csvLines.push(`SAI_KENH,,Nội dung nhiều lỗi,invalid_date`);
                }
            } else {
                const channel = i % 2 === 0 ? 'ZALO' : 'FACEBOOK';
                csvLines.push(`${channel},candidate_${i},Học phí ngành CNTT ra sao ạ?,2026-10-24T09:00:00Z`);
            }
        }

        const csvContent = csvLines.join('\n');

        const result = await useCase.execute({
            type: 'csv',
            csvContent,
        });

        // 1. Kiểm tra tổng số dòng đã xử lý đúng 100 dòng
        expect(result.total).toBe(100);

        // 2. Số lượng lỗi và số lượng thành công phải chính xác
        expect(result.errorCount).toBe(invalidRowMap.size); // 7 dòng lỗi
        expect(result.successCount).toBe(100 - invalidRowMap.size); // 93 dòng thành công
        expect(result.importedIds).toHaveLength(93);

        // 3. Toàn bộ các dòng lỗi được liệt kê rõ số dòng và lý do
        const expectedErrorRows = Array.from(invalidRowMap.keys());
        const actualErrorRows = result.errors.map((e) => e.row);
        expect(actualErrorRows).toEqual(expectedErrorRows);

        // 4. Kiểm tra từng dòng lỗi có lý do giải thích chính xác
        result.errors.forEach((err) => {
            const expectedInfo = invalidRowMap.get(err.row);
            expect(expectedInfo).toBeDefined();
            expect(err.reason).toContain(expectedInfo!.reasonKeyword);
            // Dòng trong file CSV tương ứng (header là line 1 => dòng i là line i+1)
            expect(err.csvLine).toBe(err.row + 1);
        });

        // 5. Xác minh cơ sở dữ liệu nhận đúng 93 bản ghi và queue được đẩy đúng 93 jobs
        expect(mockRepo.insertManyIgnoreDuplicate).toHaveBeenCalledTimes(1);
        expect(mockQueue.enqueue).toHaveBeenCalledTimes(1);
        expect(mockQueue.enqueue).toHaveBeenCalledWith(expect.arrayContaining(['imported-uuid-1', 'imported-uuid-93']));
    });
});
