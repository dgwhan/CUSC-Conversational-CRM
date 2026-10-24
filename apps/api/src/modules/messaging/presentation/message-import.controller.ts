import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Post,
    Query,
    Req,
    Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ImportMessagesUseCase } from '../application/import-messages.usecase.js';
import { generateCsvTemplate } from '../application/csv-parser.js';
import { MessageRepository } from '../infrastructure/message.repository.js';
import { Channel } from '../domain/channel.js';

@Controller('messages')
export class MessageImportController {
    constructor(
        private readonly importUseCase: ImportMessagesUseCase,
        private readonly messageRepo: MessageRepository,
    ) {}

    /**
     * Lấy danh sách tin nhắn đã được lưu vào cơ sở dữ liệu
     */
    @Get()
    async getSavedMessages(
        @Query('page') pageStr?: string,
        @Query('limit') limitStr?: string,
        @Query('channel') channel?: Channel,
        @Query('search') search?: string,
        @Query('workspaceId') queryWorkspaceId?: string,
        @Headers('x-workspace-id') headerWorkspaceId?: string,
    ) {
        const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(limitStr || '20', 10) || 20));
        const offset = (page - 1) * limit;

        const effectiveWorkspaceId = queryWorkspaceId || headerWorkspaceId;

        const { items, total } = await this.messageRepo.findMany({
            workspaceId: effectiveWorkspaceId,
            limit,
            offset,
            channel,
            search,
        });

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Tải file mẫu CSV với các cột: kênh, người gửi, nội dung, thời gian
     */
    @Get('import/template')
    getTemplate(@Res({ passthrough: true }) reply: FastifyReply) {
        const template = generateCsvTemplate();
        reply
            .header('Content-Type', 'text/csv; charset=utf-8')
            .header('Content-Disposition', 'attachment; filename="import_messages_template.csv"');
        return template;
    }

    /**
     * Nhập tin nhắn thủ công (danh sách từng dòng hoặc 1 dòng)
     */
    @Post('import/manual')
    @HttpCode(HttpStatus.OK)
    async importManual(
        @Body() body: { items?: Array<Record<string, unknown>>; workspaceId?: string } | Array<Record<string, unknown>>,
        @Headers('x-workspace-id') headerWorkspaceId?: string,
    ) {
        const items = Array.isArray(body) ? body : body?.items;
        if (!Array.isArray(items) || items.length === 0) {
            throw new BadRequestException('Danh sách tin nhắn nhập tay (items) không được để trống');
        }

        const workspaceId = (!Array.isArray(body) ? body?.workspaceId : undefined) || headerWorkspaceId;

        return this.importUseCase.execute({
            type: 'manual',
            workspaceId,
            items,
        });
    }

    /**
     * Import tin nhắn từ nội dung file CSV
     */
    @Post('import/csv')
    @HttpCode(HttpStatus.OK)
    async importCsv(
        @Body() body: { csvContent?: string; csv?: string; workspaceId?: string } | string | Record<string, unknown>,
        @Req() req: FastifyRequest & { rawBody?: Buffer },
        @Headers('x-workspace-id') headerWorkspaceId?: string,
    ) {
        let csvContent: string | undefined;
        let bodyWorkspaceId: string | undefined;

        if (typeof body === 'string') {
            csvContent = body;
        } else if (typeof body === 'object' && body !== null) {
            const b = body as { csvContent?: string; csv?: string; workspaceId?: string };
            csvContent = b.csvContent ?? b.csv;
            bodyWorkspaceId = b.workspaceId;
        }

        if (!csvContent && req.rawBody && req.rawBody.length > 0) {
            csvContent = req.rawBody.toString('utf-8');
        }

        if (!csvContent || csvContent.trim().length === 0) {
            throw new BadRequestException('Nội dung file CSV không được để trống');
        }

        const workspaceId = bodyWorkspaceId || headerWorkspaceId;

        return this.importUseCase.execute({
            type: 'csv',
            workspaceId,
            csvContent,
        });
    }

    /**
     * Import tin nhắn trực tiếp từ link Google Sheet được chia sẻ công khai
     */
    @Post('import/google-sheet')
    @HttpCode(HttpStatus.OK)
    async importGoogleSheet(
        @Body() body: { sheetUrl: string; workspaceId?: string },
        @Headers('x-workspace-id') headerWorkspaceId?: string,
    ) {
        if (!body.sheetUrl || typeof body.sheetUrl !== 'string') {
            throw new BadRequestException('Vui lòng cung cấp sheetUrl hợp lệ');
        }

        const match = body.sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!match || !match[1]) {
            throw new BadRequestException('Không tìm thấy Spreadsheet ID hợp lệ trong link Google Sheet');
        }

        const sheetId = match[1];
        const gidMatch = body.sheetUrl.match(/[#&?]gid=([0-9]+)/);
        const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';

        const csvExportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;

        let csvContent: string;
        try {
            const res = await fetch(csvExportUrl);
            if (!res.ok) {
                throw new Error(`Google Sheet trả về mã trạng thái ${res.status}`);
            }
            csvContent = await res.text();
        } catch (err) {
            throw new BadRequestException(
                `Không thể tải dữ liệu từ Google Sheet: ${(err as Error).message}. Vui lòng đảm bảo Sheet đã được chia sẻ với quyền "Bất kỳ ai có đường liên kết đều có thể xem".`,
            );
        }

        const workspaceId = body.workspaceId || headerWorkspaceId;

        return this.importUseCase.execute({
            type: 'csv',
            workspaceId,
            csvContent,
        });
    }

    /**
     * Endpoint đa năng: tự động nhận diện import thủ công JSON hoặc CSV
     */
    @Post('import')
    @HttpCode(HttpStatus.OK)
    async importGeneral(
        @Body() body: Record<string, unknown> | Array<Record<string, unknown>> | string,
        @Req() req: FastifyRequest & { rawBody?: Buffer },
        @Headers('x-workspace-id') headerWorkspaceId?: string,
    ) {
        const bodyObj = typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : undefined;
        const workspaceId = (typeof bodyObj?.workspaceId === 'string' ? bodyObj.workspaceId : undefined) || headerWorkspaceId;

        if (typeof body === 'string') {
            return this.importUseCase.execute({
                type: 'csv',
                workspaceId,
                csvContent: body,
            });
        }

        if (Array.isArray(body)) {
            return this.importUseCase.execute({
                type: 'manual',
                workspaceId,
                items: body,
            });
        }

        if (body && typeof body === 'object') {
            if (Array.isArray(body.items)) {
                return this.importUseCase.execute({
                    type: 'manual',
                    workspaceId,
                    items: body.items as Array<Record<string, unknown>>,
                });
            }

            const csv = (body.csvContent ?? body.csv) as string | undefined;
            if (typeof csv === 'string' && csv.trim().length > 0) {
                return this.importUseCase.execute({
                    type: 'csv',
                    workspaceId,
                    csvContent: csv,
                });
            }
        }

        if (req.rawBody && req.rawBody.length > 0) {
            const raw = req.rawBody.toString('utf-8');
            if (raw.trim().length > 0) {
                return this.importUseCase.execute({
                    type: 'csv',
                    workspaceId,
                    csvContent: raw,
                });
            }
        }

        throw new BadRequestException('Payload không hợp lệ (cần cung cấp items hoặc csvContent)');
    }
}
