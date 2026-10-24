import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MessageImportController } from '../../src/modules/messaging/presentation/message-import.controller.js';
import { ImportMessagesUseCase } from '../../src/modules/messaging/application/import-messages.usecase.js';
import type { MessageRepository } from '../../src/modules/messaging/infrastructure/message.repository.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

describe('MessageImportController', () => {
    let controller: MessageImportController;
    let mockUseCase: Partial<ImportMessagesUseCase>;
    let mockRepo: Partial<MessageRepository>;

    beforeEach(() => {
        mockUseCase = {
            execute: vi.fn().mockResolvedValue({
                total: 2,
                successCount: 2,
                errorCount: 0,
                errors: [],
                importedIds: ['id-1', 'id-2'],
            }),
        };

        mockRepo = {
            findMany: vi.fn().mockResolvedValue({
                items: [
                    { id: 'msg-1', content: 'Xin chào', channel: 'ZALO' },
                    { id: 'msg-2', content: 'Tư vấn học phí', channel: 'FACEBOOK' },
                ],
                total: 2,
            }),
        };

        controller = new MessageImportController(
            mockUseCase as ImportMessagesUseCase,
            mockRepo as MessageRepository,
        );
    });

    it('tải CSV template trả về file csv với đúng header', () => {
        const headerMock = vi.fn().mockReturnThis();
        const reply = {
            header: headerMock,
        } as unknown as FastifyReply;

        const res = controller.getTemplate(reply);

        expect(headerMock).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
        expect(headerMock).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment'));
        expect(res).toContain('kênh,người gửi,nội dung,thời gian');
    });

    it('lấy danh sách tin nhắn đã lưu (getSavedMessages)', async () => {
        const result = await controller.getSavedMessages('1', '10');
        expect(result.items).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.page).toBe(1);
        expect(result.totalPages).toBe(1);
        expect(mockRepo.findMany).toHaveBeenCalled();
    });

    it('nhập tay gọi usecase với type=manual', async () => {
        const items = [
            {
                kênh: 'ZALO',
                'người gửi': '0901234567',
                'nội dung': 'Alo',
                'thời gian': '2026-10-24T10:00:00Z',
            },
        ];

        const res = await controller.importManual({ items });

        expect(mockUseCase.execute).toHaveBeenCalledWith({
            type: 'manual',
            items,
        });
        expect(res.total).toBe(2);
    });

    it('báo lỗi BadRequestException khi danh sách nhập tay rỗng', async () => {
        await expect(controller.importManual({ items: [] })).rejects.toThrow(BadRequestException);
    });

    it('import CSV gọi usecase với type=csv', async () => {
        const csvContent = 'kênh,người gửi,nội dung,thời gian\nZALO,u1,alo,2026-10-24T10:00:00Z';
        const req = {} as FastifyRequest & { rawBody?: Buffer };

        const res = await controller.importCsv({ csvContent }, req);

        expect(mockUseCase.execute).toHaveBeenCalledWith({
            type: 'csv',
            csvContent,
        });
        expect(res.total).toBe(2);
    });

    it('nhận csv từ rawBody nếu body rỗng', async () => {
        const csvContent = 'kênh,người gửi,nội dung,thời gian\nZALO,u1,alo,2026-10-24T10:00:00Z';
        const req = {
            rawBody: Buffer.from(csvContent, 'utf-8'),
        } as FastifyRequest & { rawBody?: Buffer };

        await controller.importCsv({}, req);

        expect(mockUseCase.execute).toHaveBeenCalledWith({
            type: 'csv',
            csvContent,
        });
    });
});
