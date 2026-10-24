import {
    BadRequestException,
    Controller,
    HttpCode,
    HttpStatus,
    Param,
    ParseEnumPipe,
    Post,
    Req,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ReceiveInboundMessage } from "../application/receive-inbound-message.usecase.js";
import { Channel } from "../domain/channel.js";

@Controller('webhook')
export class WebhookController {
    constructor(private readonly receive: ReceiveInboundMessage) {}

    @Post(':channel')
    @HttpCode(HttpStatus.OK)
    async handle(
        @Param('channel', new ParseEnumPipe(Channel)) channel: Channel,
        @Req() req: FastifyRequest & { rawBody?: Buffer },
    ) {
        if (!req.rawBody) {
            throw new BadRequestException('Missing raw body');
        }

        await this.receive.execute({
            channel,
            rawBody: req.rawBody,
            headers: req.headers,
            query: (req.query ?? {}) as Record<string, unknown>,
        });

        return { status: 'ok' };
    }
}
