import { Channel } from "./channel.js";
import { InboundEvent } from "./inbound-event.js";

export interface RawWebhookRequest {
    // Key x-hub-signature-256
    readonly headers: Readonly<Record<string, string | undefined>>;
    // Root bytes, HMAC
    readonly rawBody: Buffer;
}

export class InvalidWebhookPayloadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidWebhookPayloadError';
    }
}

export interface ChannelAdapter {
    readonly channel: Channel;
    /** true nếu request thật sự đến từ nền tảng (kiểm tra chữ ký). Không ném lỗi. */
    verifyRequest(request: RawWebhookRequest): boolean;

    /**
   * Chuyển payload của nền tảng thành các InboundEvent chuẩn.
   * - Trả [] với sự kiện không phải tin nhắn (đã đọc, đã gửi...).
   * - Ném InvalidWebhookPayloadError nếu payload sai cấu trúc.
   */
    parseEvents(request: RawWebhookRequest): InboundEvent[];
}