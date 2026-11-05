import type { BaseApiClient } from './core.js';

export function createChannelApi(client: BaseApiClient) {
  return {
    getAuthorizeUrl(channel: string, redirectUri?: string) {
      return client.get<{ authorizeUrl: string; state: string; channel: string }>(
        `/oauth/${channel.toLowerCase()}/authorize-url`,
        { params: { redirectUri } },
      );
    },

    exchangeOAuthToken(
      channel: string,
      codeOrPayload:
        | string
        | {
            code?: string;
            state?: string;
            redirectUri?: string;
            pageId?: string;
            pageName?: string;
            accessToken?: string;
          },
      state?: string,
      redirectUri?: string,
    ) {
      const body =
        typeof codeOrPayload === 'string'
          ? { code: codeOrPayload, state: state || `st_${Date.now()}`, redirectUri }
          : codeOrPayload;

      return client.post<{
        channel: string;
        userName?: string;
        userId?: string;
        pages: Array<{
          id: string;
          externalAccountId: string;
          name: string;
          category: string;
          avatarUrl?: string;
          followerCount?: number;
          channel: string;
          accessToken: string;
        }>;
      }>(`/oauth/${channel.toLowerCase()}/exchange-token`, body);
    },

    activateChannels(pages: Record<string, unknown>[], workspaceId?: string, ownerId?: string) {
      return client.post<{ activatedCount: number; workspaceId: string; channels: Record<string, unknown>[] }>(
        '/channels/activate',
        { pages, workspaceId },
        {
          headers: {
            ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
            ...(ownerId ? { 'x-owner-id': ownerId } : {}),
          },
        },
      );
    },

    getChannels(workspaceId?: string, ownerId?: string) {
      return client.get<Record<string, unknown>[]>('/channels', {
        params: { workspaceId },
        headers: {
          ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
          ...(ownerId ? { 'x-owner-id': ownerId } : {}),
        },
      });
    },

    toggleChannel(id: string, isActive?: boolean, workspaceId?: string) {
      return client.patch<Record<string, unknown>>(
        `/channels/${id}/toggle`,
        { isActive },
        {
          headers: workspaceId ? { 'x-workspace-id': workspaceId } : {},
        },
      );
    },

    disconnectChannel(id: string, workspaceId?: string) {
      return client.delete<{ success: boolean; id: string }>(`/channels/${id}`, {
        headers: workspaceId ? { 'x-workspace-id': workspaceId } : {},
      });
    },

    syncChannel(id: string, workspaceId?: string) {
      return client.post<{ syncedCount: number; conversationsCount: number; pageName: string }>(
        `/channels/${id}/sync`,
        {},
        {
          headers: workspaceId ? { 'x-workspace-id': workspaceId } : {},
        },
      );
    },

    sendMessage(data: {
      channel: string;
      recipientId: string;
      content: string;
      channelAccountId?: string;
      conversationId?: string;
      workspaceId?: string;
    }) {
      return client.post<{
        success: boolean;
        messageId: string;
        sentAt: string;
        content: string;
        recipientId: string;
        channel: string;
      }>('/channels/send-message', data, {
        headers: data.workspaceId ? { 'x-workspace-id': data.workspaceId } : {},
      });
    },

    markFacebookConversationSeen(conversationId: string) {
      return client.post<{ success: boolean }>('/channels/mark-seen', { conversationId });
    },

    initZaloPersonalQr() {
      return client.post<{
        sessionId: string;
        qrCodeUrl: string;
        status: 'PENDING' | 'SCANNED' | 'SUCCESS' | 'EXPIRED';
        createdAt: number;
        expiresAt: number;
      }>('/channels/zalo-personal/qr-init', {});
    },

    getZaloPersonalQrStatus(sessionId: string) {
      return client.get<{
        sessionId: string;
        status: 'PENDING' | 'SCANNED' | 'SUCCESS' | 'EXPIRED';
        expiresAt: number;
        account?: {
          id: string;
          externalAccountId: string;
          displayName: string;
          avatarUrl: string;
          phone?: string;
          accessToken: string;
        };
      }>('/channels/zalo-personal/qr-status', {
        params: { sessionId },
      });
    },

    confirmZaloPersonalQr(data: {
      sessionId: string;
      displayName?: string;
      phone?: string;
      avatarUrl?: string;
      externalAccountId?: string;
    }) {
      return client.post<{
        sessionId: string;
        status: 'SUCCESS' | 'EXPIRED';
        account?: {
          id: string;
          externalAccountId: string;
          displayName: string;
          avatarUrl: string;
          phone?: string;
          accessToken: string;
        };
      }>('/channels/zalo-personal/qr-confirm', data);
    },

    getZaloSafetyConfig() {
      return client.get<{
        enabled: boolean;
        minIntervalMs: number;
        maxIntervalMs: number;
        maxMessagesPerMinute: number;
        maxStrangerPerDay: number;
        autoCooldownMinutes: number;
      }>('/channels/zalo-personal/safety-config');
    },

    updateZaloSafetyConfig(config: Record<string, unknown>) {
      return client.patch<{
        enabled: boolean;
        minIntervalMs: number;
        maxIntervalMs: number;
        maxMessagesPerMinute: number;
        maxStrangerPerDay: number;
        autoCooldownMinutes: number;
      }>('/channels/zalo-personal/safety-config', config);
    },
  };
}

