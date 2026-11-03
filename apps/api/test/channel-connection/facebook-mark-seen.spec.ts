import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageDispatcherService } from '../../src/modules/channel-connection/application/message-dispatcher.service.js';
import { Channel } from '../../src/modules/messaging/domain/channel.js';
import type { PrismaService } from '../../src/platform/database/prisma.service.js';
import type { TokenEncryptionService } from '../../src/modules/channel-connection/infrastructure/token-encryption.service.js';

describe('MessageDispatcherService Facebook mark seen', () => {
  const fetchMock = vi.fn();
  const conversationUpdate = vi.fn().mockResolvedValue({});
  const conversationFindUnique = vi.fn();
  let dispatcher: MessageDispatcherService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      statusText: 'OK',
      json: async () => ({ recipient_id: 'customer-psid' }),
    });
    conversationFindUnique.mockResolvedValue({
      workspaceId: 'workspace-id',
      channelAccount: {
        channel: Channel.FACEBOOK,
        workspaceId: 'workspace-id',
        externalAccountId: 'page-id',
        encryptedAccessToken: 'encrypted-token',
      },
      customer: { channelIdentities: { facebook: 'customer-psid' } },
      messages: [],
    });
    const prisma = {
      conversation: {
        findUnique: conversationFindUnique,
        update: conversationUpdate,
      },
    } as unknown as PrismaService;
    const encryption = {
      decrypt: vi.fn().mockReturnValue('page-access-token'),
    } as unknown as TokenEncryptionService;

    dispatcher = new MessageDispatcherService(prisma, encryption);
  });

  it('sends mark_seen to Meta before clearing the local unread count', async () => {
    await dispatcher.markFacebookConversationSeen(
      'f8a5c5b2-0fc0-4dc2-a0d8-6ab5cd111111',
      'workspace-id',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/page-id/messages?access_token=page-access-token'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          recipient: { id: 'customer-psid' },
          sender_action: 'mark_seen',
        }),
      }),
    );
    expect(conversationFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'f8a5c5b2-0fc0-4dc2-a0d8-6ab5cd111111' },
      }),
    );
    expect(conversationUpdate).toHaveBeenCalledWith({
      where: { id: 'f8a5c5b2-0fc0-4dc2-a0d8-6ab5cd111111' },
      data: { unreadCount: 0 },
    });
  });

  it('does not clear local unread state when Meta rejects mark_seen', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'Permission denied' } }),
    });

    await expect(
      dispatcher.markFacebookConversationSeen('f8a5c5b2-0fc0-4dc2-a0d8-6ab5cd111111'),
    ).rejects.toThrow('Permission denied');
    expect(conversationUpdate).not.toHaveBeenCalled();
  });
});
