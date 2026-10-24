import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel, MessageDirection } from '../domain/channel.js';
import type { InboundEvent } from '../domain/inbound-event.js';
import { INBOUND_QUEUE, type InboundMessageQueue } from '../domain/channel-adapter.port.js';
import { MessageRepository } from '../infrastructure/message.repository.js';
import {
    ValidatedImportRowSchema,
    type ImportMessagesResult,
    type RowErrorDetail,
    type ValidatedImportRow,
} from '../../../contracts/messaging.js';
import { parseCsv } from './csv-parser.js';

export interface ImportFromItemsInput {
    type: 'manual';
    items: Array<Record<string, unknown>>;
}

export interface ImportFromCsvInput {
    type: 'csv';
    csvContent: string;
}

export type ImportMessagesInput = ImportFromItemsInput | ImportFromCsvInput;

@Injectable()
export class ImportMessagesUseCase {
    private readonly logger = new Logger(ImportMessagesUseCase.name);

    constructor(
        private readonly messageRepo: MessageRepository,
        @Inject(INBOUND_QUEUE) private readonly queue: InboundMessageQueue,
    ) {}

    async execute(input: ImportMessagesInput): Promise<ImportMessagesResult> {
        interface PreparedRow {
            row: number;
            csvLine?: number;
            raw: Record<string, unknown>;
        }

        const rowsToProcess: PreparedRow[] = [];

        if (input.type === 'csv') {
            const parsed = parseCsv(input.csvContent);
            parsed.rows.forEach((r, idx) => {
                rowsToProcess.push({
                    row: idx + 1,
                    csvLine: r.csvLine,
                    raw: r.data,
                });
            });
        } else {
            input.items.forEach((item, idx) => {
                rowsToProcess.push({
                    row: idx + 1,
                    raw: item,
                });
            });
        }

        const errors: RowErrorDetail[] = [];
        const validEvents: InboundEvent[] = [];

        for (const item of rowsToProcess) {
            const validation = this.validateAndNormalizeRow(item.raw, item.row, item.csvLine);

            if (!validation.success) {
                errors.push(validation.error);
            } else {
                const valid = validation.data;
                const defaultAccountId =
                    valid.channel === Channel.MANUAL_IMPORT ? 'manual-account' : `${valid.channel.toLowerCase()}-account`;

                validEvents.push({
                    channel: valid.channel,
                    externalAccountId: valid.externalAccountId || defaultAccountId,
                    externalMessageId:
                        valid.externalMessageId ||
                        `manual-${Date.now()}-${item.row}-${Math.random().toString(36).substring(2, 7)}`,
                    senderExternalId: valid.sender,
                    direction: MessageDirection.INBOUND,
                    content: valid.content ?? null,
                    sentAt: valid.sentAt,
                    rawPayload: item.raw,
                });
            }
        }

        let createdIds: string[] = [];
        if (validEvents.length > 0) {
            const created = await this.messageRepo.insertManyIgnoreDuplicate(validEvents);
            createdIds = created.map((c) => c.id);

            if (createdIds.length > 0) {
                try {
                    await this.queue.enqueue(createdIds);
                } catch (err) {
                    this.logger.error('Failed to enqueue imported messages to queue', err as Error);
                }
            }
        }

        return {
            total: rowsToProcess.length,
            successCount: validEvents.length,
            errorCount: errors.length,
            errors,
            importedIds: createdIds,
        };
    }

    private validateAndNormalizeRow(
        raw: Record<string, unknown>,
        row: number,
        csvLine?: number,
    ): { success: true; data: ValidatedImportRow } | { success: false; error: RowErrorDetail } {
        const channelRaw =
            raw['kênh'] ?? raw['kenh'] ?? raw['channel'] ?? raw['Channel'] ?? raw['Kênh'];
        const senderRaw =
            raw['người gửi'] ??
            raw['nguoi gui'] ??
            raw['sender'] ??
            raw['senderExternalId'] ??
            raw['Sender'] ??
            raw['Người gửi'];
        const contentRaw =
            raw['nội dung'] ??
            raw['noi dung'] ??
            raw['content'] ??
            raw['text'] ??
            raw['Content'] ??
            raw['Nội dung'];
        const sentAtRaw =
            raw['thời gian'] ??
            raw['thoi gian'] ??
            raw['sentAt'] ??
            raw['timestamp'] ??
            raw['time'] ??
            raw['Thời gian'];
        const accountRaw =
            raw['account'] ?? raw['externalAccountId'] ?? raw['tài khoản'] ?? raw['Tài khoản'];
        const messageIdRaw =
            raw['messageId'] ?? raw['externalMessageId'] ?? raw['mã tin nhắn'] ?? raw['Mã tin nhắn'];

        const channelStr = typeof channelRaw === 'string' ? channelRaw.trim().toUpperCase() : channelRaw;

        let sentAtDate: Date | undefined;
        if (sentAtRaw instanceof Date) {
            sentAtDate = isNaN(sentAtRaw.getTime()) ? undefined : sentAtRaw;
        } else if (typeof sentAtRaw === 'string' && sentAtRaw.trim().length > 0) {
            const parsed = new Date(sentAtRaw.trim());
            if (!isNaN(parsed.getTime())) {
                sentAtDate = parsed;
            }
        }

        const objToValidate = {
            channel: channelStr,
            sender:
                typeof senderRaw === 'string'
                    ? senderRaw.trim()
                    : senderRaw != null
                      ? String(senderRaw).trim()
                      : '',
            content: contentRaw != null ? String(contentRaw) : null,
            sentAt: sentAtDate,
            externalAccountId: accountRaw != null ? String(accountRaw).trim() : undefined,
            externalMessageId: messageIdRaw != null ? String(messageIdRaw).trim() : undefined,
        };

        const parseResult = ValidatedImportRowSchema.safeParse(objToValidate);

        if (!parseResult.success) {
            const reasons: string[] = [];
            for (const issue of parseResult.error.issues) {
                const path = issue.path.join('.');
                const fieldName =
                    path === 'channel'
                        ? 'kênh'
                        : path === 'sender'
                          ? 'người gửi'
                          : path === 'sentAt'
                            ? 'thời gian'
                            : path;
                reasons.push(`${fieldName}: ${issue.message}`);
            }

            return {
                success: false,
                error: {
                    row,
                    csvLine,
                    reason: reasons.join('; '),
                    errors: reasons,
                    field: parseResult.error.issues[0]?.path.join('.') || undefined,
                    raw,
                },
            };
        }

        return {
            success: true,
            data: parseResult.data,
        };
    }
}
