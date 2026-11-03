import { describe, expect, it, vi } from 'vitest';
import { MessageRepository } from '../../src/modules/messaging/infrastructure/message.repository.js';
import { Channel, MessageDirection } from '../../src/modules/messaging/domain/channel.js';
import type { PrismaService } from '../../src/platform/database/prisma.service.js';

describe('MessageRepository customer reply window', () => {
  it('updates lastCustomerMessageAt for a new inbound message even when a later outbound exists', async () => {
    const sentAt = new Date('2026-11-03T02:00:00.000Z');
    const prisma = {
      channelAccount: {
        upsert: vi.fn().mockResolvedValue({ id: 'channel-account-id' }),
      },
      customer: {
        findFirst: vi.fn().mockResolvedValue({ id: 'customer-id' }),
      },
      conversation: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'conversation-id',
          tags: [],
          lastMessageAt: new Date('2026-11-03T03:00:00.000Z'),
          lastCustomerMessageAt: new Date('2026-11-02T00:00:00.000Z'),
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      message: {
        createManyAndReturn: vi.fn().mockResolvedValue([{ id: 'message-id' }]),
      },
    } as unknown as PrismaService;
    const repository = new MessageRepository(prisma);

    await repository.insertManyIgnoreDuplicate([
      {
        channel: Channel.FACEBOOK,
        externalAccountId: 'page-id',
        externalMessageId: 'inbound-id',
        senderExternalId: 'customer-psid',
        direction: MessageDirection.INBOUND,
        content: 'Khách nhắn lại',
        sentAt,
        rawPayload: {},
      },
    ]);

    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conversation-id' },
        data: expect.objectContaining({
          lastCustomerMessageAt: sentAt,
        }),
      }),
    );
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ lastMessageAt: sentAt }),
      }),
    );
  });
});
