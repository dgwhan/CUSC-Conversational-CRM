import { Logger } from "@nestjs/common";
import { Channel } from "../channel.js";

/**
 * Các giai đoạn trong vòng đời xử lý đồng bộ tag
 */
export const TAG_SYNC_STAGE = {
    READ: 'READ',       // Đọc / trích xuất tag từ payload sự kiện (Webhook, Graph API, CSV,...)
    MAP: 'MAP',         // Xử lý ánh xạ tag qua quy tắc (TagMappingEngine, regex, alias,...)
    UPDATE: 'UPDATE',   // Lưu / cập nhật dữ liệu tag vào cơ sở dữ liệu (Customer, Conversation)
    DELETE: 'DELETE',   // Gỡ tag khỏi Customer hoặc Conversation
} as const;

export type TagSyncStage = (typeof TAG_SYNC_STAGE)[keyof typeof TAG_SYNC_STAGE];

/**
 * Phân loại loại lỗi xảy ra trong quá trình đồng bộ tag
 */
export const TAG_SYNC_ERROR_TYPE = {
    TAG_READ_ERROR: 'TAG_READ_ERROR',             // Lỗi đọc tag, payload hỏng, lỗi API bên thứ 3
    TAG_MAPPING_ERROR: 'TAG_MAPPING_ERROR',       // Lỗi trong quá trình ánh xạ, regex lỗi, rule không hợp lệ
    TAG_UPDATE_ERROR: 'TAG_UPDATE_ERROR',         // Lỗi cập nhật tag vào CSDL
    TAG_DATABASE_ERROR: 'TAG_DATABASE_ERROR',     // Lỗi Prisma / CSDL khi thực thi query tag
    TAG_REMOVAL_ERROR: 'TAG_REMOVAL_ERROR',       // Lỗi khi gỡ nhãn
    TAG_VALIDATION_ERROR: 'TAG_VALIDATION_ERROR', // Tag không hợp lệ hoặc vượt quá độ dài tối đa
} as const;

export type TagSyncErrorType = (typeof TAG_SYNC_ERROR_TYPE)[keyof typeof TAG_SYNC_ERROR_TYPE];

/**
 * Các nguồn sự kiện phát sinh đồng bộ tag
 */
export const TAG_EVENT_SOURCE = {
    META_WEBHOOK: 'META_WEBHOOK',
    META_GRAPH_API: 'META_GRAPH_API',
    ZALO_WEBHOOK: 'ZALO_WEBHOOK',
    CRM_MANUAL_ACTION: 'CRM_MANUAL_ACTION',
    CSV_IMPORT: 'CSV_IMPORT',
    SYSTEM_BACKGROUND_JOB: 'SYSTEM_BACKGROUND_JOB',
} as const;

export type TagEventSource = (typeof TAG_EVENT_SOURCE)[keyof typeof TAG_EVENT_SOURCE] | string;

/**
 * Dữ liệu đầu vào khi ghi log lỗi đồng bộ tag
 */
export interface TagSyncErrorInput {
    stage: TagSyncStage;
    errorType: TagSyncErrorType;
    message: string;
    eventSource: TagEventSource;
    channel?: Channel | string;
    error?: unknown;
    customerId?: string;
    conversationId?: string;
    channelAccountId?: string;
    senderExternalId?: string;
    sourceTags?: string[];
    targetTags?: string[];
    correlationId?: string;
    occurredAt?: string | Date;
    metadata?: Record<string, any>;
}

/**
 * Cấu trúc log lỗi đồng bộ chuẩn hóa phục vụ truy vết
 */
export interface TagSyncErrorLogEntry {
    stage: TagSyncStage;
    errorType: TagSyncErrorType;
    message: string;
    eventSource: string;
    channel?: string;
    occurredAt: string;
    errorDetails?: {
        name?: string;
        message?: string;
        stack?: string;
    };
    context: {
        customerId?: string;
        conversationId?: string;
        channelAccountId?: string;
        senderExternalId?: string;
        sourceTags?: string[];
        targetTags?: string[];
        correlationId?: string;
        metadata?: Record<string, any>;
    };
}

/**
 * Danh sách từ khóa thuộc tính nhạy cảm cần lọc sạch (Redact)
 */
const SENSITIVE_KEY_PATTERNS = [
    /token/i,
    /secret/i,
    /password/i,
    /authorization/i,
    /cookie/i,
    /apikey/i,
    /api_key/i,
    /credential/i,
    /app_secret/i,
    /appsecret/i,
    /session/i,
    /private_key/i,
];

/**
 * Làm sạch chuỗi có chứa token, URL parameters hoặc bearer headers
 */
export function sanitizeSensitiveString(text: string): string {
    if (!text || typeof text !== 'string') return text;

    return text
        // Lọc access_token trong Query URL: ?access_token=EAAB... hoặc &access_token=...
        .replace(/([?&]access_token=)[^& \t\r\n]+/gi, '$1***REDACTED***')
        // Lọc generic token trong URL query param
        .replace(/([?&](?:token|app_secret|secret)=)[^& \t\r\n]+/gi, '$1***REDACTED***')
        // Lọc token dạng key-value text: "token: EAAB..." hoặc "token=EAAB..."
        .replace(/((?:access_token|token|secret|app_secret|password|credential)[\s:=]+)[A-Za-z0-9_\-\.=]{8,}/gi, '$1***REDACTED***')
        // Lọc Meta Facebook Page/User Access Token (luôn bắt đầu bằng EAA... với độ dài > 15 ký tự)
        .replace(/\b(EAA[A-Za-z0-9]{15,})\b/g, '***REDACTED***')
        // Lọc Bearer token trong Authorization headers / messages
        .replace(/(Bearer\s+)[A-Za-z0-9-_=.]+/gi, '$1***REDACTED***')
        // Lọc mã băm Facebook webhook hub signature
        .replace(/(sha256=)[A-Fa-f0-9]+/gi, '$1***REDACTED***');
}

/**
 * Kiểm tra xem tên thuộc tính có phải là dữ liệu nhạy cảm không
 */
export function isSensitiveKey(key: string): boolean {
    return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Đệ quy làm sạch object / array, loại bỏ triệt để access token và thông tin nhạy cảm
 */
export function sanitizeSensitiveData<T = any>(data: T, seen = new WeakSet<object>()): T {
    if (data === null || data === undefined) {
        return data;
    }

    if (typeof data === 'string') {
        return sanitizeSensitiveString(data) as unknown as T;
    }

    if (typeof data !== 'object') {
        return data;
    }

    // Chống đệ quy vô hạn với circular references
    if (seen.has(data as object)) {
        return '[CIRCULAR_REFERENCE]' as unknown as T;
    }
    seen.add(data as object);

    if (Array.isArray(data)) {
        return data.map((item) => sanitizeSensitiveData(item, seen)) as unknown as T;
    }

    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
        if (isSensitiveKey(key)) {
            if (typeof value === 'object' && value !== null) {
                // Nếu là object nhóm (vd: credentials: { appSecret: '...' }), tiếp tục đệ quy để bảo vệ cấu trúc
                cleaned[key] = sanitizeSensitiveData(value, seen);
            } else {
                cleaned[key] = '***REDACTED***';
            }
        } else if (typeof value === 'string') {
            cleaned[key] = sanitizeSensitiveString(value);
        } else if (typeof value === 'object' && value !== null) {
            cleaned[key] = sanitizeSensitiveData(value, seen);
        } else {
            cleaned[key] = value;
        }
    }

    return cleaned as T;
}

/**
 * Service ghi log lỗi đồng bộ tag chuyên trách của hệ thống CRM
 */
export class TagSyncLogger {
    private readonly logger = new Logger('TagSyncService');
    private readonly errorBuffer: TagSyncErrorLogEntry[] = [];
    private readonly maxBufferSize = 100;

    /**
     * Ghi log lỗi đồng bộ tag với thông tin truy vết đầy đủ và bảo mật dữ liệu nhạy cảm
     */
    logError(input: TagSyncErrorInput): TagSyncErrorLogEntry {
        const occurredAt = input.occurredAt
            ? (input.occurredAt instanceof Date ? input.occurredAt.toISOString() : new Date(input.occurredAt).toISOString())
            : new Date().toISOString();

        // 1. Trích xuất chi tiết lỗi
        let errorDetails: { name?: string; message?: string; stack?: string } | undefined;
        if (input.error) {
            if (input.error instanceof Error) {
                errorDetails = {
                    name: input.error.name,
                    message: sanitizeSensitiveString(input.error.message),
                    stack: input.error.stack ? sanitizeSensitiveString(input.error.stack) : undefined,
                };
            } else if (typeof input.error === 'object') {
                errorDetails = sanitizeSensitiveData(input.error as any);
            } else {
                errorDetails = { message: sanitizeSensitiveString(String(input.error)) };
            }
        }

        // 2. Làm sạch context metadata để không bao giờ rò rỉ token hay secret
        const sanitizedMetadata = input.metadata ? sanitizeSensitiveData(input.metadata) : undefined;

        // 3. Chuẩn hóa bản ghi log có tính truy vết cao
        const entry: TagSyncErrorLogEntry = {
            stage: input.stage,
            errorType: input.errorType,
            message: sanitizeSensitiveString(input.message),
            eventSource: sanitizeSensitiveString(input.eventSource),
            channel: input.channel ? String(input.channel) : undefined,
            occurredAt,
            errorDetails,
            context: {
                customerId: input.customerId,
                conversationId: input.conversationId,
                channelAccountId: input.channelAccountId,
                senderExternalId: input.senderExternalId,
                sourceTags: input.sourceTags ? [...input.sourceTags] : undefined,
                targetTags: input.targetTags ? [...input.targetTags] : undefined,
                correlationId: input.correlationId,
                metadata: sanitizedMetadata,
            },
        };

        // 4. Định dạng chuỗi log NestJS tiêu chuẩn
        const logLine = `[TAG_SYNC_ERROR] [STAGE: ${entry.stage}] [TYPE: ${entry.errorType}] [SOURCE: ${entry.eventSource}] [CHANNEL: ${entry.channel || 'N/A'}] ${entry.message} | Context: ${JSON.stringify(entry.context)}`;

        this.logger.error(logLine, errorDetails?.stack || errorDetails?.message);

        // 5. Lưu vào buffer gần nhất phục vụ kiểm tra sức khỏe hệ thống & chẩn đoán lỗi
        this.errorBuffer.unshift(entry);
        if (this.errorBuffer.length > this.maxBufferSize) {
            this.errorBuffer.pop();
        }

        return entry;
    }

    /**
     * Lấy danh sách các lỗi đồng bộ tag gần nhất
     */
    getRecentErrors(limit = 20): readonly TagSyncErrorLogEntry[] {
        return this.errorBuffer.slice(0, limit);
    }

    /**
     * Lấy lỗi đồng bộ tag gần nhất
     */
    getLastError(): TagSyncErrorLogEntry | undefined {
        return this.errorBuffer[0];
    }

    /**
     * Xóa sạch buffer log (phục vụ reset trong unit test)
     */
    clearBuffer(): void {
        this.errorBuffer.length = 0;
    }
}

/**
 * Singleton instance của TagSyncLogger phục vụ toàn bộ messaging & channel domain
 */
export const tagSyncLogger = new TagSyncLogger();
