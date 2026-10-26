import {
    BadRequestException,
    Controller,
    ForbiddenException,
    Get,
    HttpCode,
    HttpStatus,
    Injectable,
    Logger,
    Optional,
    Param,
    PipeTransform,
    Post,
    Req,
    Res,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ReceiveInboundMessage } from "../application/receive-inbound-message.usecase.js";
import { ChannelAdapterRegistry } from "../application/channel-adapter.registry.js";
import { Channel } from "../domain/channel.js";
import { FacebookAdapter } from "../infrastructure/adapters/facebook.adapter.js";

/**
 * Pipe chuẩn hóa channel không phân biệt hoa thường (hỗ trợ cả /facebook và /FACEBOOK)
 */
@Injectable()
export class ChannelPipe implements PipeTransform<string, Channel> {
    transform(value: string): Channel {
        const normalized = value ? value.toUpperCase().trim() : '';
        if (normalized && Object.values(Channel).includes(normalized as Channel)) {
            return normalized as Channel;
        }
        throw new BadRequestException(`Validation failed: unsupported channel "${value}"`);
    }
}

@Controller('webhook')
export class WebhookController {
    private readonly logger = new Logger(WebhookController.name);

    constructor(
        private readonly receive: ReceiveInboundMessage,
        @Optional() private readonly adapters?: ChannelAdapterRegistry,
    ) {}

    /**
     * Xác thực Webhook GET từ Meta Facebook (Hub challenge handshake)
     * Meta gửi các query param: hub.mode=subscribe, hub.verify_token, hub.challenge
     * - Khớp verify token: trả về hub.challenge dạng plain text, HTTP 200
     * - Sai verify token hoặc mode: trả về HTTP 403 Forbidden
     */
    @Get(':channel')
    @HttpCode(HttpStatus.OK)
    async verify(
        @Param('channel', new ChannelPipe()) channel: Channel,
        @Req() req: FastifyRequest,
        @Res({ passthrough: true }) res: FastifyReply,
    ): Promise<string | { status: string }> {
        if (channel === Channel.FACEBOOK) {
            const adapter = this.adapters?.get(Channel.FACEBOOK);
            if (adapter && 'verifySubscription' in adapter && typeof (adapter as FacebookAdapter).verifySubscription === 'function') {
                const query = (req.query ?? {}) as Record<string, unknown>;
                const challenge = (adapter as FacebookAdapter).verifySubscription(query);

                if (challenge !== null) {
                    if (res && typeof res.header === 'function') {
                        res.header('content-type', 'text/plain');
                    }
                    return challenge;
                }
                throw new ForbiddenException('Invalid verify token or subscription mode');
            }
        }

        return { status: 'ok' };
    }

    /**
     * Nhận sự kiện Webhook POST từ Meta / Zalo
     * - Kiểm tra chữ ký X-Hub-Signature-256 (HMAC SHA-256). Nếu sai chữ ký -> trả 401 Unauthorized.
     * - Đảm bảo thời gian phản hồi dưới 3000ms (giới hạn bảo vệ 2500ms) để tránh Meta retry liên tục.
     */
    @Post(':channel')
    @HttpCode(HttpStatus.OK)
    async handle(
        @Param('channel', new ChannelPipe()) channel: Channel,
        @Req() req: FastifyRequest & { rawBody?: Buffer },
    ) {
        if (!req.rawBody) {
            throw new BadRequestException('Missing raw body');
        }

        const executionPromise = this.receive.execute({
            channel,
            rawBody: req.rawBody,
            headers: req.headers,
            query: (req.query ?? {}) as Record<string, unknown>,
        });

        // Giới hạn thời gian phản hồi an toàn 2500ms (< 3000ms)
        // Nếu việc xử lý DB hoặc hàng đợi mất hơn 2.5s, hệ thống sẽ phản hồi 200 OK trước
        // để phía Facebook không rơi vào vòng lặp retry liên tục (retry loop)
        const timeoutPromise = new Promise<'TIMEOUT'>((resolve) =>
            setTimeout(() => resolve('TIMEOUT'), 2500),
        );

        const result = await Promise.race([executionPromise, timeoutPromise]);
        if (result === 'TIMEOUT') {
            this.logger.warn(`Webhook execution took > 2500ms for channel ${channel}. Responded 200 OK early to prevent Meta retry loop.`);
        }

        return { status: 'ok' };
    }
}
