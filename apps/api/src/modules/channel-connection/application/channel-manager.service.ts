import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  Optional,
  Inject,
} from '@nestjs/common';
import { CUSTOMER_GATEWAY } from '../../messaging/domain/customer-gateway.port.js';
import type { CustomerGateway } from '../../messaging/domain/customer-gateway.port.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { TokenEncryptionService } from '../infrastructure/token-encryption.service.js';
import { ZcaPersonalService } from './zca-personal.service.js';
import { MessageRepository } from '../../messaging/infrastructure/message.repository.js';
import { RealtimeService } from '../../realtime/realtime.service.js';
import { MessageDispatcherService, SendMessageInput, SendMessageResult } from './message-dispatcher.service.js';
import { ChannelSyncService, ChannelSyncResult } from './channel-sync.service.js';
import { Channel } from '../../messaging/domain/channel.js';
import type {
  ActivateChannelsBody,
  ActivateChannelsResult,
  ChannelAccountDto,
} from '../../../contracts/channel-connection.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalizeWorkspaceId = (workspaceId?: string): string | undefined =>
  workspaceId && UUID_REGEX.test(workspaceId) ? workspaceId : undefined;

@Injectable()
export class ChannelManagerService {
  private readonly logger = new Logger(ChannelManagerService.name);
  private readonly dispatcher: MessageDispatcherService;
  private readonly sync: ChannelSyncService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: TokenEncryptionService,
    @Optional() private readonly messageRepo?: MessageRepository,
    @Optional() private readonly realtime?: RealtimeService,
    @Optional() private readonly zcaService?: ZcaPersonalService,
    @Optional() @Inject(CUSTOMER_GATEWAY) private readonly customerGateway?: CustomerGateway,
    @Optional() dispatcherService?: MessageDispatcherService,
    @Optional() syncService?: ChannelSyncService,
  ) {
    this.dispatcher =
      dispatcherService ||
      new MessageDispatcherService(prisma, encryption, messageRepo, realtime, zcaService);
    this.sync =
      syncService ||
      new ChannelSyncService(prisma, encryption, messageRepo, realtime, zcaService, customerGateway);
  }

  /**
   * Kích hoạt danh sách Fanpage / OA vào Workspace:
   * Mã hóa AES-256 các access token, lưu vào DB và đăng ký Webhook Subscription.
   */
  async activateChannels(input: ActivateChannelsBody, ownerId?: string): Promise<ActivateChannelsResult> {
    // 1. Xác định Workspace mục tiêu
    let targetWorkspaceId = normalizeWorkspaceId(input.workspaceId);

    if (!targetWorkspaceId) {
      // Tìm workspace theo ownerId nếu có
      if (ownerId) {
        const ownerWs = await this.prisma.workspace.findFirst({
          where: { ownerId },
          orderBy: { createdAt: 'asc' },
        });
        if (ownerWs) {
          targetWorkspaceId = ownerWs.id;
        }
      }

      if (!targetWorkspaceId) {
        // Tìm workspace khả dụng đầu tiên hoặc mặc định
        const firstWs = await this.prisma.workspace.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        });

        if (firstWs) {
          targetWorkspaceId = firstWs.id;
        } else {
          // Tự động tìm user đầu tiên để làm owner
          const firstUser = await this.prisma.user.findFirst();
          if (!firstUser) {
            throw new NotFoundException('No user found in system to create default workspace');
          }

          const newWs = await this.prisma.workspace.create({
            data: {
              name: 'Tổ hợp Công nghệ PolarisX',
              slug: `polarisx-${Date.now().toString(36)}`,
              ownerId: firstUser.id,
              isActive: true,
            },
          });
          targetWorkspaceId = newWs.id;
        }
      }
    } else {
      const exists = await this.prisma.workspace.findUnique({
        where: { id: targetWorkspaceId },
      });
      if (!exists) {
        throw new NotFoundException(`Workspace ${targetWorkspaceId} not found`);
      }
    }

    const activatedAccounts: ChannelAccountDto[] = [];

    // 2. Lưu từng Fanpage / OA vào DB
    for (const page of input.pages) {
      const encryptedAccessToken = page.accessToken
        ? this.encryption.encrypt(page.accessToken)
        : null;

      const encryptedRefreshToken = page.refreshToken
        ? this.encryption.encrypt(page.refreshToken)
        : null;

      const channelEnum = page.channel as Channel;

      // 3. Đăng ký Webhook Subscribed Apps nếu là Facebook thật
      let isWebhookSubscribed = true;
      let webhookError: string | undefined;

      if (
        page.channel === 'FACEBOOK' &&
        page.accessToken
      ) {
        const subResult = await this.subscribePageWebhook(page.externalAccountId, page.accessToken);
        isWebhookSubscribed = subResult.success;
        webhookError = subResult.error;
      }

      // 4. Nếu là kênh ZALO: Đảm bảo không tạo trùng lặp kênh trong cùng Workspace
      if (channelEnum === Channel.ZALO || page.channel === 'ZALO') {
        let existingZalos: any[] = [];
        if (this.prisma.channelAccount?.findMany) {
          existingZalos = await this.prisma.channelAccount.findMany({
            where: {
              workspaceId: targetWorkspaceId,
              channel: Channel.ZALO,
            },
          }).catch(() => []);
        }

        if (existingZalos.length > 0) {
          const primaryZalo = existingZalos[0];
          // Nếu có nhiều hơn 1 kênh Zalo cũ bị trùng lặp, xóa các bản ghi thừa
          if (existingZalos.length > 1 && this.prisma.channelAccount?.deleteMany) {
            const duplicateIds = existingZalos.slice(1).map((z: any) => z.id);
            await this.prisma.channelAccount.deleteMany({
              where: { id: { in: duplicateIds } },
            }).catch(() => null);
            this.logger.log(`Cleaned up ${duplicateIds.length} duplicate Zalo channel accounts in workspace ${targetWorkspaceId}`);
          }

          if (this.prisma.channelAccount?.update) {
            const previousDisconnectedAt = primaryZalo.disconnectedAt;
            const updated = await this.prisma.channelAccount.update({
              where: { id: primaryZalo.id },
              data: {
                externalAccountId: page.externalAccountId,
                displayName: page.displayName || primaryZalo.displayName,
                avatarUrl: page.avatarUrl || primaryZalo.avatarUrl,
                encryptedAccessToken,
                refreshToken: encryptedRefreshToken,
                tokenExpiresAt: page.tokenExpiresAt
                  ? new Date(page.tokenExpiresAt)
                  : new Date(Date.now() + 72 * 60 * 60 * 1000),
                disconnectedAt: null,
                isActive: true,
                metadata: {
                  ...((primaryZalo.metadata as any) || {}),
                  ...(page.metadata || {}),
                  lastReconnectedAt: new Date().toISOString(),
                  ...(previousDisconnectedAt
                    ? { previousDisconnectedAt: previousDisconnectedAt.toISOString() }
                    : {}),
                } as any,
              },
            });
            activatedAccounts.push(this.mapToDto(updated));

            // Tự động kích hoạt cơ chế Auto Backfill Sync chống mất tin nhắn
            if (this.zcaService) {
              this.zcaService
                .syncCloudMessages(page.externalAccountId, previousDisconnectedAt)
                .catch((err) =>
                  this.logger.warn(`Auto backfill sync error: ${err?.message}`),
                );
            }
            continue;
          }
        }
      }

      const existingAccount = await this.prisma.channelAccount.findUnique({
        where: {
          channel_externalAccountId: {
            channel: channelEnum,
            externalAccountId: page.externalAccountId,
          },
        },
      });
      const prevDisconnected = existingAccount?.disconnectedAt;

      const zaloExpiry =
        channelEnum === Channel.ZALO || page.channel === 'ZALO'
          ? new Date(Date.now() + 72 * 60 * 60 * 1000)
          : null;

      const account = await this.prisma.channelAccount.upsert({
        where: {
          channel_externalAccountId: {
            channel: channelEnum,
            externalAccountId: page.externalAccountId,
          },
        },
        update: {
          workspaceId: targetWorkspaceId,
          displayName: page.displayName,
          avatarUrl: page.avatarUrl || null,
          encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: page.tokenExpiresAt
            ? new Date(page.tokenExpiresAt)
            : zaloExpiry,
          disconnectedAt: null,
          isWebhookSubscribed,
          isActive: true,
          metadata: {
            ...(page.metadata || {}),
            ...(webhookError ? { webhookError } : {}),
            lastReconnectedAt: new Date().toISOString(),
          } as any,
        },
        create: {
          workspaceId: targetWorkspaceId,
          channel: channelEnum,
          externalAccountId: page.externalAccountId,
          displayName: page.displayName,
          avatarUrl: page.avatarUrl || null,
          encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: page.tokenExpiresAt
            ? new Date(page.tokenExpiresAt)
            : zaloExpiry,
          disconnectedAt: null,
          isWebhookSubscribed,
          isActive: true,
          metadata: {
            ...(page.metadata || {}),
            ...(webhookError ? { webhookError } : {}),
            lastReconnectedAt: new Date().toISOString(),
          } as any,
        },
      });

      if (
        (channelEnum === Channel.ZALO || page.channel === 'ZALO') &&
        this.zcaService
      ) {
        this.zcaService
          .syncCloudMessages(page.externalAccountId, prevDisconnected)
          .catch((err) =>
            this.logger.warn(`Auto backfill sync error: ${err?.message}`),
          );
      }

      activatedAccounts.push(this.mapToDto(account));
    }

    this.logger.log(`Activated ${activatedAccounts.length} channel accounts for workspace ${targetWorkspaceId}`);

    return {
      activatedCount: activatedAccounts.length,
      workspaceId: targetWorkspaceId,
      channels: activatedAccounts,
    };
  }

  /**
   * Lấy danh sách các kênh đã liên kết thuộc về một Workspace cụ thể.
   * TUYỆT ĐỐI CÔ LẬP DỮ LIỆU: Không bao giờ trả về danh sách kênh của toàn hệ thống nếu thiếu workspaceId.
   */
  async getChannels(workspaceId?: string, ownerId?: string): Promise<ChannelAccountDto[]> {
    let effectiveWorkspaceId = normalizeWorkspaceId(workspaceId);

    if (!effectiveWorkspaceId && ownerId) {
      const ownerWs = await this.prisma.workspace.findFirst({
        where: { ownerId },
        select: { id: true },
      });
      if (ownerWs) {
        effectiveWorkspaceId = ownerWs.id;
      }
    }

    if (!effectiveWorkspaceId) {
      // Nếu không chỉ định, lấy workspace mặc định đầu tiên của tenant hiện tại
      const defaultWs = await this.prisma.workspace.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      if (!defaultWs) return [];
      effectiveWorkspaceId = defaultWs.id;
    }

    const accounts = await this.prisma.channelAccount.findMany({
      where: {
        workspaceId: effectiveWorkspaceId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map((a) => this.mapToDto(a));
  }

  /**
   * Bật / Tắt trạng thái hoạt động của kênh.
   * BẢO MẬT: Kiểm tra quyền sở hữu workspaceId trước khi thay đổi.
   */
  async toggleChannel(id: string, workspaceId?: string, setActive?: boolean): Promise<ChannelAccountDto> {
    const current = await this.prisma.channelAccount.findUnique({
      where: { id },
    });

    if (!current) {
      throw new NotFoundException(`Channel account ${id} not found`);
    }

    // Kiểm tra cô lập dữ liệu nếu có workspaceId
    if (workspaceId && current.workspaceId && current.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied: You do not have permission to modify this channel account');
    }

    const nextState = setActive !== undefined ? setActive : !current.isActive;

    const updated = await this.prisma.channelAccount.update({
      where: { id },
      data: { isActive: nextState },
    });

    return this.mapToDto(updated);
  }

  /**
   * Hủy liên kết kênh.
   * BẢO MẬT: Kiểm tra quyền sở hữu workspaceId trước khi xóa.
   */
  async disconnectChannel(id: string, workspaceId?: string): Promise<{ success: boolean; id: string }> {
    let exists: any = null;

    if (this.prisma.channelAccount?.findUnique) {
      exists = await this.prisma.channelAccount.findUnique({
        where: { id },
      }).catch(() => null);
    }

    if (!exists && this.prisma.channelAccount?.findFirst) {
      exists = await this.prisma.channelAccount.findFirst({
        where: { externalAccountId: id },
      }).catch(() => null);
    }

    if (!exists) {
      return { success: true, id };
    }

    // Kiểm tra cô lập dữ liệu nếu có workspaceId
    if (workspaceId && exists.workspaceId && exists.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied: You do not have permission to delete this channel account');
    }

    if (this.prisma.message?.deleteMany) {
      await this.prisma.message.deleteMany({
        where: { channelAccountId: exists.id },
      }).catch(() => null);
    }

    if (this.prisma.conversation?.deleteMany) {
      await this.prisma.conversation.deleteMany({
        where: { channelAccountId: exists.id },
      }).catch(() => null);
    }

    if (this.prisma.channelAccount?.delete) {
      await this.prisma.channelAccount.delete({
        where: { id: exists.id },
      });
    }

    return { success: true, id: exists.id };
  }

  /**
   * Lấy access token đã giải mã để gọi API Outbound
   */
  async getDecryptedAccessToken(channelAccountId: string, workspaceId?: string): Promise<string | null> {
    const account = await this.prisma.channelAccount.findUnique({
      where: { id: channelAccountId },
      select: { encryptedAccessToken: true, workspaceId: true },
    });

    if (!account?.encryptedAccessToken) return null;

    if (workspaceId && account.workspaceId && account.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied: Token belongs to a different workspace');
    }

    return this.encryption.decrypt(account.encryptedAccessToken);
  }

  /**
   * Gửi tin nhắn Outbound tới khách hàng qua Zalo OA API, Zalo Cá nhân, hoặc Facebook Graph API
   */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    return this.dispatcher.sendMessage(input);
  }

  async markFacebookConversationSeen(conversationId: string, workspaceId?: string): Promise<void> {
    return this.dispatcher.markFacebookConversationSeen(conversationId, workspaceId);
  }

  /**
   * Đăng ký Page Webhook vào App trên Meta Graph API
   */
  private async subscribePageWebhook(
    pageId: string,
    pageAccessToken: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${pageAccessToken}`;
      const res = await fetch(url, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success !== true) {
        const errMsg = json.error?.message || JSON.stringify(json);
        this.logger.warn(`Meta subscribed_apps returned: ${errMsg}`);
        return { success: false, error: errMsg };
      }
      this.logger.log(`Successfully subscribed page ${pageId} to Meta Webhook events.`);
      return { success: true };
    } catch (err: unknown) {
      const errMsg = (err as Error).message;
      this.logger.warn(`Could not subscribe page webhook for ${pageId}: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  /**
   * Đồng bộ tin nhắn kênh (Tự động điều phối theo Zalo OA / Zalo Cá nhân hoặc Facebook Fanpage)
   */
  async syncChannel(channelAccountId: string, workspaceId?: string): Promise<ChannelSyncResult> {
    return this.sync.syncChannel(channelAccountId, workspaceId);
  }

  /**
   * Đồng bộ tin nhắn và hội thoại gần nhất từ Zalo (Hỗ trợ Zalo OA & Zalo Cá nhân zca-js)
   */
  async syncZaloMessages(accountOrId: any, workspaceId?: string): Promise<ChannelSyncResult> {
    return this.sync.syncZaloMessages(accountOrId, workspaceId);
  }

  /**
   * Đồng bộ tin nhắn từ Facebook Graph API cho một ChannelAccount đã kết nối
   */
  async syncFacebookMessages(channelAccountId: string, workspaceId?: string): Promise<ChannelSyncResult> {
    return this.sync.syncFacebookMessages(channelAccountId, workspaceId);
  }

  private mapToDto(account: any): ChannelAccountDto {
    const isPersonal = Boolean(account.metadata?.isPersonal || account.metadata?.engine === 'zca-js' || account.channel === 'ZALO_PERSONAL');
    return {
      isPersonal,
      metadata: account.metadata || null,
      id: account.id,
      workspaceId: account.workspaceId,
      channel: account.channel as any,
      externalAccountId: account.externalAccountId,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      isActive: account.isActive,
      isWebhookSubscribed: account.isWebhookSubscribed,
      hasToken: !!account.encryptedAccessToken,
      tokenExpiresAt: account.tokenExpiresAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
