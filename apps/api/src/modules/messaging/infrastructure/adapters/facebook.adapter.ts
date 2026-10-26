import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import crypto from "node:crypto";
import {
    ChannelAdapter,
    InvalidWebhookPayloadError,
    RawWebhookRequest,
} from "../../domain/channel-adapter.port.js";
import { Channel, MessageDirection } from "../../domain/channel.js";
import { InboundEvent } from "../../domain/inbound-event.js";

export interface FacebookAttachment {
    type: string;
    payload?: {
        url?: string;
        sticker_id?: number | string;
        [key: string]: unknown;
    };
}

export interface FacebookMessagingEvent {
    sender?: { id: string };
    recipient?: { id: string };
    timestamp?: number;
    message?: {
        mid: string;
        text?: string;
        is_echo?: boolean;
        app_id?: number;
        quick_reply?: { payload: string };
        attachments?: FacebookAttachment[];
        [key: string]: unknown;
    };
    postback?: {
        mid?: string;
        title?: string;
        payload?: string;
        [key: string]: unknown;
    };
    delivery?: unknown;
    read?: unknown;
    [key: string]: unknown;
}

export interface FacebookEntry {
    id?: string;
    time?: number;
    messaging?: FacebookMessagingEvent[];
    standby?: FacebookMessagingEvent[];
    [key: string]: unknown;
}

export interface FacebookWebhookPayload {
    object?: string;
    entry?: FacebookEntry[];
    events?: unknown[];
    [key: string]: unknown;
}

@Injectable()
export class FacebookAdapter implements ChannelAdapter {
    readonly channel = Channel.FACEBOOK;
    private readonly logger = new Logger(FacebookAdapter.name);

    private appSecretOverride?: string;
    private verifyTokenOverride?: string;

    constructor(@Optional() private readonly configService?: ConfigService) {}

    /** Cho phép gán trực tiếp App Secret phục vụ unit test / kiểm thử động */
    setAppSecret(secret: string): void {
        this.appSecretOverride = secret;
    }

    /** Cho phép gán trực tiếp Verify Token phục vụ unit test / kiểm thử động */
    setVerifyToken(token: string): void {
        this.verifyTokenOverride = token;
    }

    getAppSecret(): string | undefined {
        return (
            this.appSecretOverride ??
            this.configService?.get<string>('META_APP_SECRET') ??
            this.configService?.get<string>('FB_APP_SECRET') ??
            process.env.META_APP_SECRET ??
            process.env.FB_APP_SECRET
        );
    }

    getVerifyToken(): string {
        return (
            this.verifyTokenOverride ??
            this.configService?.get<string>('META_WEBHOOK_VERIFY_TOKEN') ??
            this.configService?.get<string>('FB_VERIFY_TOKEN') ??
            process.env.META_WEBHOOK_VERIFY_TOKEN ??
            process.env.FB_VERIFY_TOKEN ??
            'cusc_recruitment_crm_webhook_verify_secret'
        );
    }

    /**
     * Xác thực Webhook GET Subscription từ Meta (Hub verification)
     * Meta gửi các query params: hub.mode, hub.verify_token, hub.challenge
     * Trả về chuỗi challenge nếu hợp lệ, ngược lại trả về null
     */
    verifySubscription(query: Record<string, unknown>): string | null {
        const mode = (query['hub.mode'] ?? (query.hub as any)?.mode ?? query['hub_mode']) as string | undefined;
        const verifyToken = (query['hub.verify_token'] ?? (query.hub as any)?.verify_token ?? query['hub_verify_token']) as string | undefined;
        const challenge = (query['hub.challenge'] ?? (query.hub as any)?.challenge ?? query['hub_challenge']) as string | undefined;

        const expectedToken = this.getVerifyToken();

        if (mode === 'subscribe' && verifyToken && expectedToken && verifyToken === expectedToken) {
            this.logger.log('Facebook webhook verify token matched successfully.');
            return challenge ? String(challenge) : '';
        }

        this.logger.warn(
            `Facebook webhook verification failed. Received mode=${mode}, token=${verifyToken ? '***' : 'missing'}`
        );
        return null;
    }

    /**
     * Xác thực chữ ký X-Hub-Signature-256 (HMAC SHA-256 trên raw body)
     * Header format: sha256=<signature_hex>
     * Trả về false nếu chữ ký sai hoặc bị giả mạo.
     */
    verifyRequest(request: RawWebhookRequest): boolean {
        const rawSig =
            request.headers['x-hub-signature-256'] ??
            request.headers['X-Hub-Signature-256'];
        const sigHeader = Array.isArray(rawSig) ? rawSig[0] : rawSig;

        const appSecret = this.getAppSecret();

        // Không có header chữ ký
        if (!sigHeader) {
            // Nếu có appSecret được cấu hình, bắt buộc phải có chữ ký
            if (appSecret) {
                this.logger.warn('Missing X-Hub-Signature-256 header while appSecret is configured.');
                return false;
            }
            // Nếu là dev không có secret, cho phép qua nếu không ở production
            return process.env.NODE_ENV !== 'production';
        }

        if (!appSecret) {
            this.logger.warn('Received X-Hub-Signature-256 header but META_APP_SECRET is not configured.');
            return false;
        }

        if (typeof sigHeader !== 'string' || !sigHeader.startsWith('sha256=')) {
            this.logger.warn('X-Hub-Signature-256 header does not have sha256= prefix.');
            return false;
        }

        const receivedHex = sigHeader.slice(7).trim();
        if (!receivedHex) {
            return false;
        }

        try {
            const bodyBuffer = Buffer.isBuffer(request.rawBody)
                ? request.rawBody
                : Buffer.from(request.rawBody || '');

            const hmac = crypto.createHmac('sha256', appSecret);
            hmac.update(bodyBuffer);
            const expectedHex = hmac.digest('hex');

            if (expectedHex.length !== receivedHex.length) {
                return false;
            }

            return crypto.timingSafeEqual(
                Buffer.from(expectedHex, 'utf8'),
                Buffer.from(receivedHex, 'utf8'),
            );
        } catch (error) {
            this.logger.error('Error during X-Hub-Signature-256 HMAC verification:', error);
            return false;
        }
    }

    /**
     * Parse payload từ Meta:
     * - Đọc cả tin đến (INBOUND) từ khách hàng
     * - Đọc cả tin echo (OUTBOUND) khi Page gửi đi (message.is_echo = true)
     * - Trích xuất text, quick_reply, hoặc tóm tắt attachments nếu không có text
     */
    parseEvents(request: RawWebhookRequest): InboundEvent[] {
        let body: FacebookWebhookPayload;
        try {
            body = JSON.parse(request.rawBody.toString('utf-8'));
        } catch {
            throw new InvalidWebhookPayloadError('Request body must be valid JSON');
        }

        // 1. Hỗ trợ định dạng mock/test { events: [...] }
        if (Array.isArray(body.events)) {
            return (body.events as unknown[]).map((item, index) => {
                const e = item as Record<string, unknown>;
                const isEcho = Boolean(e.is_echo || e.isEcho || e.direction === MessageDirection.OUTBOUND);
                return {
                    channel: this.channel,
                    externalAccountId: String(e.account ?? e.externalAccountId ?? 'fb-page-default'),
                    externalMessageId: String(e.messageId ?? e.externalMessageId ?? `fb-${Date.now()}-${index}`),
                    senderExternalId: String(e.sender ?? e.senderExternalId ?? (isEcho ? 'page-admin' : 'unknown-sender')),
                    direction: isEcho ? MessageDirection.OUTBOUND : MessageDirection.INBOUND,
                    content: (e.text ?? e.content ?? null) as string | null,
                    sentAt: e.sentAt ? new Date(e.sentAt as string) : new Date(),
                    rawPayload: e,
                };
            });
        }

        // 2. Định dạng chuẩn của Meta Messenger Webhook (object: 'page')
        if (body.object === 'page' && Array.isArray(body.entry)) {
            const events: InboundEvent[] = [];

            for (const entry of body.entry) {
                const pageId = String(entry.id ?? 'fb-page-default');
                const messagingList = (entry.messaging ?? entry.standby ?? []) as FacebookMessagingEvent[];

                for (const messaging of messagingList) {
                    // Bỏ qua các sự kiện giao hàng (delivery) hoặc đã xem (read) thuần túy không có nội dung
                    if (!messaging.message && !messaging.postback) {
                        continue;
                    }

                    // A. Xử lý tin nhắn (Message)
                    if (messaging.message && messaging.message.mid) {
                        const msg = messaging.message;
                        const isEcho = Boolean(msg.is_echo);
                        const direction = isEcho ? MessageDirection.OUTBOUND : MessageDirection.INBOUND;

                        // Nếu là tin echo (Page gửi đi):
                        //   - sender là Page ID
                        //   - recipient là PSID khách hàng
                        // Nếu là tin đến (khách gửi đến):
                        //   - sender là PSID khách hàng
                        //   - recipient là Page ID
                        const senderExternalId = isEcho
                            ? String(messaging.sender?.id ?? pageId)
                            : String(messaging.sender?.id ?? 'unknown-sender');

                        const externalAccountId = pageId;

                        // Lấy nội dung tin nhắn hoặc tóm tắt attachment
                        let content: string | null = msg.text ?? null;
                        if (!content && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
                            const firstAtt = msg.attachments[0];
                            const attType = firstAtt?.type || 'tệp';
                            const attUrl = firstAtt?.payload?.url;
                            content = attUrl ? `[${attType}: ${attUrl}]` : `[Đính kèm ${attType}]`;
                        } else if (!content && msg.quick_reply?.payload) {
                            content = msg.quick_reply.payload;
                        }

                        events.push({
                            channel: this.channel,
                            externalAccountId,
                            externalMessageId: String(msg.mid),
                            senderExternalId,
                            direction,
                            content,
                            sentAt: new Date(Number(messaging.timestamp || Date.now())),
                            rawPayload: messaging,
                        });
                        continue;
                    }

                    // B. Xử lý postback (khách bấm nút Get Started hoặc nút chọn nhanh)
                    if (messaging.postback) {
                        const pb = messaging.postback;
                        const externalMessageId = pb.mid
                            ? String(pb.mid)
                            : `fb-postback-${messaging.timestamp || Date.now()}-${messaging.sender?.id || 'unknown'}`;

                        events.push({
                            channel: this.channel,
                            externalAccountId: pageId,
                            externalMessageId,
                            senderExternalId: String(messaging.sender?.id ?? 'unknown-sender'),
                            direction: MessageDirection.INBOUND,
                            content: pb.title || pb.payload || '[Postback Button Click]',
                            sentAt: new Date(Number(messaging.timestamp || Date.now())),
                            rawPayload: messaging,
                        });
                    }
                }
            }

            return events;
        }

        return [];
    }

    /**
     * Tiện ích tạo chữ ký HMAC SHA-256 phục vụ testing
     */
    signPayload(rawBody: Buffer | string, secret?: string): string {
        const sec = secret || this.getAppSecret() || 'default-test-secret';
        const buffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
        const hmac = crypto.createHmac('sha256', sec);
        hmac.update(buffer);
        return `sha256=${hmac.digest('hex')}`;
    }
}
