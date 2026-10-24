import { Injectable } from "@nestjs/common";
import { Message, Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service.js";
import { InboundEvent } from "../domain/inbound-event.js";
import { Channel, MessageDirection } from "../domain/channel.js";

@Injectable()
export class MessageRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findById(id: string): Promise<Message | null> {
        return this.prisma.message.findUnique({
            where: { id },
        });
    }

    async markProcessed(id: string, processedAt: Date = new Date()): Promise<void> {
        await this.prisma.message.update({
            where: { id },
            data: { processedAt },
        });
    }

    async findMany(options?: {
        limit?: number;
        offset?: number;
        channel?: Channel;
        search?: string;
    }): Promise<{ items: any[]; total: number }> {
        const where: Prisma.MessageWhereInput = {};
        if (options?.channel) {
            where.channel = options.channel;
        }
        if (options?.search) {
            where.OR = [
                { content: { contains: options.search, mode: 'insensitive' } },
                { externalMessageId: { contains: options.search, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await Promise.all([
            this.prisma.message.findMany({
                where,
                include: {
                    channelAccount: {
                        select: {
                            displayName: true,
                            externalAccountId: true,
                        },
                    },
                },
                orderBy: { sentAt: 'desc' },
                take: options?.limit ?? 50,
                skip: options?.offset ?? 0,
            }),
            this.prisma.message.count({ where }),
        ]);

        return { items, total };
    }

    async insertManyIgnoreDuplicate(events: InboundEvent[]): Promise<Array<{ id: string }>> {
        if (events.length === 0) {
            return [];
        }

        // 1. Khử trùng lặp ngay trong cùng một batch (tránh lỗi PostgreSQL không thể affect cùng 1 hàng 2 lần trong 1 lệnh)
        const seenKeys = new Set<string>();
        const uniqueEvents: InboundEvent[] = [];
        for (const event of events) {
            const key = `${event.channel}:${event.externalMessageId}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniqueEvents.push(event);
            }
        }

        // 2. Đảm bảo tồn tại ChannelAccount cho từng cặp (channel, externalAccountId)
        const uniqueAccounts = new Map<string, { channel: InboundEvent['channel']; externalAccountId: string }>();
        for (const event of uniqueEvents) {
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

        const messagesData = uniqueEvents.map((e) => {
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

        // 3. Chèn với skipDuplicates: true (sinh ra SQL: ON CONFLICT DO NOTHING RETURNING id)
        // Chỉ các dòng mới được chèn thực sự mới có id trong kết quả trả về
        return this.prisma.message.createManyAndReturn({
            data: messagesData,
            skipDuplicates: true,
            select: { id: true },
        });
    }
}
