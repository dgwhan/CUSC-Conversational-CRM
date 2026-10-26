import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { WebhookController, ChannelPipe } from '../../src/modules/messaging/presentation/webhook.controller.js';
import { ReceiveInboundMessage } from '../../src/modules/messaging/application/receive-inbound-message.usecase.js';
import { Channel } from '../../src/modules/messaging/domain/channel.js';
import { ChannelAdapterRegistry } from '../../src/modules/messaging/application/channel-adapter.registry.js';
import { FacebookAdapter } from '../../src/modules/messaging/infrastructure/adapters/facebook.adapter.js';

describe('WebhookController', () => {
    let controller: WebhookController;
    let mockReceive: Partial<ReceiveInboundMessage>;
    let facebookAdapter: FacebookAdapter;
    let registry: ChannelAdapterRegistry;

    const testVerifyToken = 'cusc_webhook_test_verify_token';
    const testAppSecret = 'cusc_test_app_secret_32_characters';

    beforeEach(() => {
        facebookAdapter = new FacebookAdapter();
        facebookAdapter.setVerifyToken(testVerifyToken);
        facebookAdapter.setAppSecret(testAppSecret);

        registry = new ChannelAdapterRegistry([facebookAdapter]);

        mockReceive = {
            execute: vi.fn().mockResolvedValue(undefined),
        };

        controller = new WebhookController(
            mockReceive as ReceiveInboundMessage,
            registry,
        );
    });

    describe('GET :channel (Verify Token Handshake)', () => {
        it('trả về hub.challenge khi token Meta Facebook trùng khớp', async () => {
            const req = {
                query: {
                    'hub.mode': 'subscribe',
                    'hub.verify_token': testVerifyToken,
                    'hub.challenge': '123456789',
                },
            } as unknown as FastifyRequest;

            const res = {
                header: vi.fn(),
            } as unknown as FastifyReply;

            const result = await controller.verify(Channel.FACEBOOK, req, res);

            expect(result).toBe('123456789');
            expect(res.header).toHaveBeenCalledWith('content-type', 'text/plain');
        });

        it('ném ForbiddenException (HTTP 403) khi sai verify token', async () => {
            const req = {
                query: {
                    'hub.mode': 'subscribe',
                    'hub.verify_token': 'wrong-token',
                    'hub.challenge': '123456789',
                },
            } as unknown as FastifyRequest;

            const res = { header: vi.fn() } as unknown as FastifyReply;

            await expect(controller.verify(Channel.FACEBOOK, req, res)).rejects.toThrow(ForbiddenException);
        });

        it('trả về status ok cho các kênh không yêu cầu hub verification', async () => {
            const req = { query: {} } as unknown as FastifyRequest;
            const res = { header: vi.fn() } as unknown as FastifyReply;

            const result = await controller.verify(Channel.ZALO, req, res);
            expect(result).toEqual({ status: 'ok' });
        });
    });

    describe('POST :channel (Nhận Webhook & Xác thực chữ ký & Giới hạn phản hồi < 3000ms)', () => {
        it('ném BadRequestException nếu thiếu rawBody', async () => {
            const req = {
                headers: {},
                query: {},
            } as unknown as FastifyRequest & { rawBody?: Buffer };

            await expect(controller.handle(Channel.FACEBOOK, req)).rejects.toThrow(BadRequestException);
        });

        it('trả về HTTP 401 (UnauthorizedException) khi chữ ký không hợp lệ', async () => {
            mockReceive.execute = vi.fn().mockRejectedValue(new UnauthorizedException('Invalid webhook signature'));

            const req = {
                rawBody: Buffer.from('{"object":"page"}'),
                headers: { 'x-hub-signature-256': 'sha256=invalidhex123' },
                query: {},
            } as unknown as FastifyRequest & { rawBody?: Buffer };

            await expect(controller.handle(Channel.FACEBOOK, req)).rejects.toThrow(UnauthorizedException);
        });

        it('trả về { status: "ok" } khi chữ ký hợp lệ', async () => {
            const rawBody = Buffer.from('{"object":"page","entry":[]}');
            const validSig = facebookAdapter.signPayload(rawBody, testAppSecret);

            const req = {
                rawBody,
                headers: { 'x-hub-signature-256': validSig },
                query: {},
            } as unknown as FastifyRequest & { rawBody?: Buffer };

            const res = await controller.handle(Channel.FACEBOOK, req);

            expect(res).toEqual({ status: 'ok' });
            expect(mockReceive.execute).toHaveBeenCalledWith({
                channel: Channel.FACEBOOK,
                rawBody,
                headers: { 'x-hub-signature-256': validSig },
                query: {},
            });
        });

        it('hệ thống phản hồi dưới 3000ms ngay cả khi tác vụ nền kéo dài (ngừa Meta retry loop)', async () => {
            // Giả lập tác vụ xử lý DB chậm mất 3500ms
            mockReceive.execute = vi.fn().mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 3500)),
            );

            const rawBody = Buffer.from('{"object":"page"}');
            const req = {
                rawBody,
                headers: {},
                query: {},
            } as unknown as FastifyRequest & { rawBody?: Buffer };

            const startTime = Date.now();
            const res = await controller.handle(Channel.FACEBOOK, req);
            const duration = Date.now() - startTime;

            expect(res).toEqual({ status: 'ok' });
            // Chắc chắn phản hồi dưới 3000ms (giới hạn bảo vệ 2500ms)
            expect(duration).toBeLessThan(3000);
        });
    });

    describe('ChannelPipe (Chuẩn hóa URL channel không phân biệt hoa thường)', () => {
        const pipe = new ChannelPipe();

        it('chuyển đổi "facebook" chữ thường thành Channel.FACEBOOK', () => {
            expect(pipe.transform('facebook')).toBe(Channel.FACEBOOK);
        });

        it('chuyển đổi "zalo" chữ thường thành Channel.ZALO', () => {
            expect(pipe.transform('zalo')).toBe(Channel.ZALO);
        });

        it('ném BadRequestException với kênh không hỗ trợ', () => {
            expect(() => pipe.transform('invalid_channel')).toThrow(BadRequestException);
        });
    });
});
