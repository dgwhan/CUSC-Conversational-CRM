import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { WebhookController } from '../../src/modules/messaging/presentation/webhook.controller.js';
import { ReceiveInboundMessage } from '../../src/modules/messaging/application/receive-inbound-message.usecase.js';
import { Channel } from '../../src/modules/messaging/domain/channel.js';

describe('WebhookController', () => {
    let controller: WebhookController;
    let mockReceive: Partial<ReceiveInboundMessage>;

    beforeEach(() => {
        mockReceive = {
            execute: vi.fn().mockResolvedValue(undefined),
        };
        controller = new WebhookController(mockReceive as ReceiveInboundMessage);
    });

    it('throws BadRequestException if rawBody is missing', async () => {
        const req = {
            headers: {},
            query: {},
        } as unknown as FastifyRequest & { rawBody?: Buffer };

        await expect(controller.handle(Channel.ZALO, req)).rejects.toThrow(BadRequestException);
    });

    it('passes rawBody, headers, query, and channel to ReceiveInboundMessage', async () => {
        const rawBody = Buffer.from('{"events":[]}');
        const headers = { 'x-fake-signature': 'abc' };
        const query = { hub: 'challenge' };

        const req = {
            rawBody,
            headers,
            query,
        } as unknown as FastifyRequest & { rawBody?: Buffer };

        const res = await controller.handle(Channel.ZALO, req);

        expect(res).toEqual({ status: 'ok' });
        expect(mockReceive.execute).toHaveBeenCalledWith({
            channel: Channel.ZALO,
            rawBody,
            headers,
            query,
        });
    });
});
