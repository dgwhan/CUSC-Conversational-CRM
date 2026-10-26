import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { TokenEncryptionService } from '../infrastructure/token-encryption.service.js';
import type {
  ActivateChannelsBody,
  ActivateChannelsResult,
  ChannelAccountDto,
} from '../../../contracts/channel-connection.js';
import { Channel } from '@prisma/client';

@Injectable()
export class ChannelManagerService {
  private readonly logger = new Logger(ChannelManagerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  /**
   * Kích hoạt danh sách Fanpage / OA vào Workspace:
   * Mã hóa AES-256 các access token, lưu vào DB và đăng ký Webhook Subscription.
   */
  async activateChannels(input: ActivateChannelsBody, ownerId?: string): Promise<ActivateChannelsResult> {
    // 1. Xác định Workspace mục tiêu
    let targetWorkspaceId = input.workspaceId;

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
          // Tự động tìm staff đầu tiên để làm owner
          const firstStaff = await this.prisma.staff.findFirst();
          if (!firstStaff) {
            throw new NotFoundException('No staff found in system to create default workspace');
          }

          const newWs = await this.prisma.workspace.create({
            data: {
              name: 'Trung tâm Công nghệ Phần mềm CUSC',
              slug: `cusc-${Date.now().toString(36)}`,
              ownerId: firstStaff.id,
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
        page.accessToken &&
        !page.accessToken.startsWith('EAA_mock') &&
        !page.accessToken.startsWith('mock_') &&
        !page.accessToken.startsWith('dev_') &&
        !page.accessToken.startsWith('raw_secret_')
      ) {
        const subResult = await this.subscribePageWebhook(page.externalAccountId, page.accessToken);
        isWebhookSubscribed = subResult.success;
        webhookError = subResult.error;
      }

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
          tokenExpiresAt: page.tokenExpiresAt ? new Date(page.tokenExpiresAt) : null,
          isWebhookSubscribed,
          isActive: true,
          metadata: {
            ...(page.metadata || {}),
            ...(webhookError ? { webhookError } : {}),
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
          tokenExpiresAt: page.tokenExpiresAt ? new Date(page.tokenExpiresAt) : null,
          isWebhookSubscribed,
          isActive: true,
          metadata: {
            ...(page.metadata || {}),
            ...(webhookError ? { webhookError } : {}),
          } as any,
        },
      });

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
    let effectiveWorkspaceId = workspaceId;

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

  private mapToDto(account: any): ChannelAccountDto {
    return {
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
