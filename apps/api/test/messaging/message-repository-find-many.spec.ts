import { describe, expect, it, vi } from 'vitest';
import { MessageRepository } from '../../src/modules/messaging/infrastructure/message.repository.js';
import { Channel } from '../../src/modules/messaging/domain/channel.js';
import type { PrismaService } from '../../src/platform/database/prisma.service.js';

describe('MessageRepository.findMany', () => {
    const validUuid = '11111111-2222-3333-4444-555555555555';

    it('handles channel="ALL", "all", or "" without passing invalid enum to where', async () => {
        const findManyMock = vi.fn().mockResolvedValue([]);
        const countMock = vi.fn().mockResolvedValue(0);
        const prisma = {
            message: {
                findMany: findManyMock,
                count: countMock,
            },
        } as unknown as PrismaService;

        const repo = new MessageRepository(prisma);

        await repo.findMany({ channel: 'ALL' });
        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {},
            }),
        );

        await repo.findMany({ channel: '' as any });
        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {},
            }),
        );
    });

    it('maps ZALO_PERSONAL to Channel.ZALO', async () => {
        const findManyMock = vi.fn().mockResolvedValue([]);
        const countMock = vi.fn().mockResolvedValue(0);
        const prisma = {
            message: {
                findMany: findManyMock,
                count: countMock,
            },
        } as unknown as PrismaService;

        const repo = new MessageRepository(prisma);

        await repo.findMany({ channel: 'ZALO_PERSONAL' });
        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    AND: [{ channel: Channel.ZALO }],
                },
            }),
        );
    });

    it('safely handles non-UUID workspaceId and does not filter by invalid workspace', async () => {
        const findManyMock = vi.fn().mockResolvedValue([]);
        const countMock = vi.fn().mockResolvedValue(0);
        const prisma = {
            message: {
                findMany: findManyMock,
                count: countMock,
            },
        } as unknown as PrismaService;

        const repo = new MessageRepository(prisma);

        await repo.findMany({ workspaceId: 'default' });
        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {},
            }),
        );
    });

    it('combines workspaceId and search with AND conditions without collision', async () => {
        const findManyMock = vi.fn().mockResolvedValue([]);
        const countMock = vi.fn().mockResolvedValue(0);
        const prisma = {
            message: {
                findMany: findManyMock,
                count: countMock,
            },
        } as unknown as PrismaService;

        const repo = new MessageRepository(prisma);

        await repo.findMany({
            workspaceId: validUuid,
            search: 'test search',
            channel: 'FACEBOOK',
        });

        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    AND: [
                        {
                            OR: [
                                { channelAccount: { workspaceId: validUuid } },
                                { conversation: { workspaceId: validUuid } },
                            ],
                        },
                        { channel: Channel.FACEBOOK },
                        {
                            OR: [
                                { content: { contains: 'test search', mode: 'insensitive' } },
                                { externalMessageId: { contains: 'test search', mode: 'insensitive' } },
                            ],
                        },
                    ],
                },
            }),
        );
    });

    it('returns empty list gracefully if prisma throws database error', async () => {
        const prisma = {
            message: {
                findMany: vi.fn().mockRejectedValue(new Error('Connection lost')),
                count: vi.fn().mockRejectedValue(new Error('Connection lost')),
            },
        } as unknown as PrismaService;

        const repo = new MessageRepository(prisma);

        const result = await repo.findMany({ workspaceId: validUuid });
        expect(result).toEqual({ items: [], total: 0 });
    });

    it('safely maps rawPayload when stringified or when channelIdentities is an array', async () => {
        const mockMsg = {
            id: 'msg-1',
            channel: Channel.ZALO,
            direction: 'INBOUND',
            content: 'Hello',
            rawPayload: JSON.stringify({ sender: { id: 'sender-1', name: 'Nguyen Van A' } }),
            sentAt: new Date(),
            conversation: {
                customer: {
                    id: 'cust-1',
                    fullName: 'Nguyen Van A',
                    channelIdentities: [
                        { channel: 'ZALO', externalUserId: 'sender-1' },
                    ],
                },
            },
        };

        const prisma = {
            message: {
                findMany: vi.fn().mockResolvedValue([mockMsg]),
                count: vi.fn().mockResolvedValue(1),
            },
        } as unknown as PrismaService;

        const repo = new MessageRepository(prisma);
        const result = await repo.findMany();

        expect(result.total).toBe(1);
        expect(result.items[0].senderExternalId).toBe('sender-1');
        expect(result.items[0].customerName).toBe('Nguyen Van A');
    });
});
