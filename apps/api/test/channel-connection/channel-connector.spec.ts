import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from '../../src/modules/channel-connection/application/oauth.service.js';
import { ChannelManagerService } from '../../src/modules/channel-connection/application/channel-manager.service.js';
import { ChannelConnectorController } from '../../src/modules/channel-connection/presentation/channel-connector.controller.js';
import { TokenEncryptionService } from '../../src/modules/channel-connection/infrastructure/token-encryption.service.js';

describe('OAuthService & ChannelConnectorController', () => {
  let oauthService: OAuthService;
  let channelManagerService: ChannelManagerService;
  let controller: ChannelConnectorController;
  let mockPrisma: any;

  beforeEach(() => {
    const config = new ConfigService({
      NODE_ENV: 'development',
      TOKEN_ENCRYPTION_KEY: 'test_token_encryption_key_32_characters_long_12345',
      META_APP_ID: '1234567890',
      META_APP_SECRET: 'meta_secret_test',
      FRONTEND_URL: 'http://localhost:5173',
    });

    const encryption = new TokenEncryptionService(config);
    oauthService = new OAuthService(config);

    mockPrisma = {
      workspace: {
        findFirst: vi.fn().mockResolvedValue({ id: 'ws-uuid-001', name: 'CUSC Workspace' }),
        findUnique: vi.fn().mockResolvedValue({ id: 'ws-uuid-001', name: 'CUSC Workspace' }),
        create: vi.fn(),
      },
      staff: {
        findFirst: vi.fn().mockResolvedValue({ id: 'staff-uuid-001' }),
      },
      channelAccount: {
        upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve({
          id: 'acc-uuid-1',
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'acc-uuid-1',
            workspaceId: 'ws-uuid-001',
            channel: 'FACEBOOK',
            externalAccountId: 'page_123',
            displayName: 'Fanpage Tuyển Sinh',
            avatarUrl: 'https://example.com/avatar.jpg',
            isActive: true,
            isWebhookSubscribed: true,
            encryptedAccessToken: 'iv:tag:cipher',
            tokenExpiresAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
        findUnique: vi.fn().mockResolvedValue({
          id: 'acc-uuid-1',
          workspaceId: 'ws-uuid-001',
          isActive: true,
        }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 'acc-uuid-1',
          workspaceId: 'ws-uuid-001',
          channel: 'FACEBOOK',
          externalAccountId: 'page_123',
          displayName: 'Fanpage Tuyển Sinh',
          isActive: data.isActive,
          isWebhookSubscribed: true,
          encryptedAccessToken: 'iv:tag:cipher',
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        delete: vi.fn().mockResolvedValue({ id: 'acc-uuid-1' }),
      },
    };

    channelManagerService = new ChannelManagerService(mockPrisma, encryption);
    controller = new ChannelConnectorController(oauthService, channelManagerService);
  });

  describe('OAuthService', () => {
    it('should generate Facebook authorization URL with state and required scopes from config', () => {
      const res = oauthService.generateAuthorizeUrl('FACEBOOK', 'http://localhost:5173/cb');
      expect(res.channel).toBe('FACEBOOK');
      expect(res.state).toBeDefined();
      expect(res.authorizeUrl).toContain('facebook.com');
      expect(res.authorizeUrl).toContain('pages_messaging');
      expect(res.authorizeUrl).toContain('pages_manage_metadata');
      expect(res.authorizeUrl).toContain('client_id=1234567890');
    });

    it('should generate Zalo authorization URL with app_id and state', () => {
      const res = oauthService.generateAuthorizeUrl('ZALO');
      expect(res.channel).toBe('ZALO');
      expect(res.authorizeUrl).toContain('oauth.zaloapp.com');
    });

    it('should return discovered pages when exchanging mock token', async () => {
      const result = await oauthService.exchangeToken('FACEBOOK', 'mock_auth_code_123', 'state_test');
      expect(result.channel).toBe('FACEBOOK');
      expect(result.pages.length).toBeGreaterThan(0);
      expect(result.pages[0].name).toContain('PolarisX');
      expect(result.pages[0].accessToken).toBeDefined();
    });
  });

  describe('ChannelConnectorController (Data Isolation & Security)', () => {
    it('should reject invalid channel on GET /api/oauth/:channel/authorize-url', () => {
      expect(() => controller.getAuthorizeUrl('INVALID_CHANNEL', {})).toThrow(
        /Invalid channel/,
      );
    });

    it('should return authorize URL for valid channel', () => {
      const res = controller.getAuthorizeUrl('facebook', {});
      expect(res.channel).toBe('FACEBOOK');
      expect(res.authorizeUrl).toBeDefined();
    });

    it('should exchange code and return discovered pages', async () => {
      const res = await controller.exchangeToken('facebook', {
        code: 'mock_code',
        state: 'valid_state',
      });
      expect(res.pages).toBeDefined();
      expect(res.pages.length).toBeGreaterThan(0);
    });

    it('should activate selected pages, encrypting their tokens', async () => {
      const res = await controller.activateChannels({
        workspaceId: 'ws-uuid-001',
        pages: [
          {
            channel: 'FACEBOOK',
            externalAccountId: 'page_456',
            displayName: 'Fanpage Aptech Cần Thơ',
            accessToken: 'raw_secret_access_token_123',
          },
        ],
      });

      expect(res.activatedCount).toBe(1);
      expect(mockPrisma.channelAccount.upsert).toHaveBeenCalledTimes(1);

      const upsertArg = mockPrisma.channelAccount.upsert.mock.calls[0][0];
      // Token must be encrypted (not plaintext)
      expect(upsertArg.create.encryptedAccessToken).not.toBe('raw_secret_access_token_123');
      expect(upsertArg.create.encryptedAccessToken).toContain(':');
      expect(upsertArg.create.workspaceId).toBe('ws-uuid-001');
    });

    it('should list channels strictly scoped to workspaceId with masked token status', async () => {
      const list = await controller.getChannels('ws-uuid-001');
      expect(list).toHaveLength(1);
      expect(list[0].displayName).toBe('Fanpage Tuyển Sinh');
      expect(list[0].hasToken).toBe(true);
      // Raw token must never be present in DTO
      expect((list[0] as any).encryptedAccessToken).toBeUndefined();

      expect(mockPrisma.channelAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: 'ws-uuid-001' },
        }),
      );
    });

    it('should toggle channel active status within the same workspace', async () => {
      const updated = await controller.toggleChannel('acc-uuid-1', false, 'ws-uuid-001');
      expect(updated.isActive).toBe(false);
      expect(mockPrisma.channelAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-uuid-1' },
        data: { isActive: false },
      });
    });

    it('should throw ForbiddenException if attempting to toggle a channel from a different workspace', async () => {
      await expect(
        controller.toggleChannel('acc-uuid-1', false, 'different-workspace-attacker'),
      ).rejects.toThrow(/Access denied/);
    });

    it('should disconnect a channel within the same workspace', async () => {
      const res = await controller.disconnectChannel('acc-uuid-1', 'ws-uuid-001');
      expect(res.success).toBe(true);
      expect(mockPrisma.channelAccount.delete).toHaveBeenCalledWith({
        where: { id: 'acc-uuid-1' },
      });
    });

    it('should throw ForbiddenException if attempting to disconnect a channel from a different workspace', async () => {
      await expect(
        controller.disconnectChannel('acc-uuid-1', 'different-workspace-attacker'),
      ).rejects.toThrow(/Access denied/);
    });
  });
});
