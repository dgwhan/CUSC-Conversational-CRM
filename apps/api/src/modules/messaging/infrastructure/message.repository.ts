import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service.js";
import { InboundEvent } from "../domain/inbound-event.js";
import { MessageDirection } from "../domain/channel.js";

@Injectable()
export class MessageRepository {
    constructor(private readonly prisma: PrismaService) {}

    async insertManyIgnoreDuplicate(events: InboundEvent[]): Promise<Array<{ id: string }>> {
        if (events.length === 0) {
            return [];
        }

        // Đảm bảo tồn tại ChannelAccount cho từng cặp (channel, externalAccountId)
        const uniqueAccounts = new Map<string, { channel: InboundEvent['channel']; externalAccountId: string }>();
        for (const event of events) {
            const key = `${event.channel}:${event.externalAccountId}`;
            if (!uniqueAccounts.has(key)) {
                uniqueAccounts.set(key, {
                    channel: event.channel,
                    externalAccountId: event.externalAccountId,
                });
            }
        }

        const accountMap = new Map<string, string>();
        for (const [key, { channel, externalAccountId }] of uniqueAccounts.entries()) {
            const account = await this.prisma.channelAccount.upsert({
                where: {
                    channel_externalAccountId: {
                        channel,
                        externalAccountId,
                    },
                },
                update: {},
                create: {
                    channel,
                    externalAccountId,
                    displayName: externalAccountId,
                },
                select: { id: true },
            });
            accountMap.set(key, account.id);
        }

        const messagesData = events.map((e) => {
            const accountId = accountMap.get(`${e.channel}:${e.externalAccountId}`)!;
            return {
                channelAccountId: accountId,
                channel: e.channel,
                direction: e.direction ?? MessageDirection.INBOUND,
                content: e.content,
                sentAt: e.sentAt,
                externalMessageId: e.externalMessageId,
                rawPayload: (e.rawPayload ?? {}) as Prisma.InputJsonValue,
            };
        });

        return this.prisma.message.createManyAndReturn({
            data: messagesData,
            skipDuplicates: true,
            select: { id: true },
        });
    }
}
