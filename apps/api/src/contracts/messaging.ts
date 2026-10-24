import { z } from 'zod';
import { Channel } from '../modules/messaging/domain/channel.js';

export const ChannelEnumSchema = z.enum(
    [Channel.ZALO, Channel.FACEBOOK, Channel.TIKTOK, Channel.MANUAL_IMPORT] as const,
    {
        message: 'Kênh không hợp lệ. Chỉ chấp nhận: ZALO, FACEBOOK, TIKTOK, MANUAL_IMPORT',
    },
);

export const RawImportRowSchema = z.object({
    kênh: z.string().optional(),
    channel: z.string().optional(),
    'người gửi': z.string().optional(),
    sender: z.string().optional(),
    senderExternalId: z.string().optional(),
    'nội dung': z.string().nullable().optional(),
    content: z.string().nullable().optional(),
    text: z.string().nullable().optional(),
    'thời gian': z.string().optional(),
    sentAt: z.union([z.string(), z.date()]).optional(),
    timestamp: z.string().optional(),
    time: z.string().optional(),
    externalAccountId: z.string().optional(),
    account: z.string().optional(),
    externalMessageId: z.string().optional(),
    messageId: z.string().optional(),
}).passthrough();

export const ValidatedImportRowSchema = z.object({
    channel: ChannelEnumSchema,
    sender: z.string().trim().min(1, 'Người gửi không được để trống'),
    content: z.string().nullable().optional(),
    sentAt: z.date({
        message: 'Thời gian không đúng định dạng ngày giờ hợp lệ',
    }),
    externalAccountId: z.string().optional(),
    externalMessageId: z.string().optional(),
});

export type RawImportRow = z.infer<typeof RawImportRowSchema>;
export type ValidatedImportRow = z.infer<typeof ValidatedImportRowSchema>;

export interface RowErrorDetail {
    row: number;
    csvLine?: number;
    reason: string;
    field?: string;
    errors: string[];
    raw?: Record<string, unknown>;
}

export interface ImportMessagesResult {
    total: number;
    successCount: number;
    errorCount: number;
    errors: RowErrorDetail[];
    importedIds: string[];
}
