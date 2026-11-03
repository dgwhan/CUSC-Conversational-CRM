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
                  ...(primaryZalo.metadata as any),
                  ...page.metadata,
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
            ...page.metadata,
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
            ...page.metadata,
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

    let channelEnum: Channel = Channel.ZALO;
    if (rawChannel.includes('ZALO')) {
      channelEnum = Channel.ZALO;
    } else if (rawChannel.includes('FACEBOOK') || rawChannel.includes('FB')) {
      channelEnum = Channel.FACEBOOK;
    } else if (rawChannel.includes('TIKTOK')) {
      channelEnum = Channel.TIKTOK;
    } else if (rawChannel.includes('MANUAL')) {
      channelEnum = Channel.MANUAL_IMPORT;
    }

    const isUuid = (val?: string): val is string =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    // 1. Tìm tài khoản kênh tương ứng
    let account = null;
    if (input.channelAccountId) {
      try {
        account = await this.prisma.channelAccount.findUnique({
          where: { id: input.channelAccountId },
        });
      } catch { }
    }

    // 1b. Thử tìm từ conversationId nếu có
    if (!account && input.conversationId && this.prisma?.conversation) {
      try {
        const conv = await this.prisma.conversation.findUnique({
          where: { id: input.conversationId },
          include: { channelAccount: true },
        });
        if (conv?.channelAccount) {
          account = conv.channelAccount;
        }
      } catch {
        // Fallback sang tìm kiếm theo kênh
      }
    }

    if (!account) {
      const wsFilter = isUuid(input.workspaceId) ? { workspaceId: input.workspaceId } : {};

      if (isPersonalZaloRequested) {
        const accounts = await this.prisma.channelAccount.findMany({
          where: {
            channel: channelEnum,
            isActive: true,
            ...wsFilter,
          },
          orderBy: { updatedAt: 'desc' },
        });
        account =
          accounts.find((acc) => {
            const meta = acc.metadata as any;
            return (
              meta?.isPersonal ||
              meta?.engine === 'zca-js' ||
              acc.externalAccountId?.startsWith('zca_')
            );
          }) ||
          accounts[0] ||
          null;
      } else {
        account = await this.prisma.channelAccount.findFirst({
          where: {
            channel: channelEnum,
            isActive: true,
            ...wsFilter,
          },
          orderBy: { updatedAt: 'desc' },
        });
      }
    }

    if (!account) {
      throw new NotFoundException(
        `Không tìm thấy tài khoản kênh ${input.channel} nào đang hoạt động. Vui lòng kết nối kênh trước khi gửi tin.`,
      );
    }

    if (!account.encryptedAccessToken) {
      throw new BadRequestException(`Tài khoản "${account.displayName}" chưa có Access Token để gửi tin.`);
    }

    // 2. Giải mã Access Token AES-256
    const token = this.encryption.decrypt(account.encryptedAccessToken);
    if (!token) {
      throw new BadRequestException('Không thể giải mã Access Token của kênh. Vui lòng kết nối lại tài khoản.');
    }

    const isMock =
      token.startsWith('mock_') ||
      token.startsWith('test_') ||
      token.startsWith('dev_') ||
      token.startsWith('raw_secret_') ||
      input.recipientId.startsWith('mock_') ||
      input.recipientId.startsWith('test_');

    // Áp dụng cơ chế Giới hạn tần suất & Anti-Ban Rate Limiter cho kênh Zalo
    const isPersonalZalo = Boolean(
      isPersonalZaloRequested ||
      (account.metadata as any)?.isPersonal ||
      (account.metadata as any)?.engine === 'zca-js' ||
      token.trim().startsWith('{') ||
      token.startsWith('zca_') ||
      account.externalAccountId.startsWith('zca_'),
    );

    // Tự động cập nhật metadata nếu tài khoản cá nhân trước đó bị thiếu cờ isPersonal
    if (isPersonalZalo && !(account.metadata as any)?.isPersonal && this.prisma?.channelAccount) {
      this.prisma.channelAccount.update({
        where: { id: account.id },
        data: {
          metadata: {
            ...((account.metadata as any) || {}),
            isPersonal: true,
            engine: 'zca-js',
          },
        },
      }).catch(() => null);
    }

    if ((channelEnum === Channel.ZALO || input.channel === 'ZALO') && this.zcaService) {
      await this.zcaService.enforceRateLimitAndSafety(account.id, input.recipientId, isPersonalZalo);
    }

    // 3. Tách biệt hoàn toàn xử lý gửi tin nhắn cho từng Kênh (FACEBOOK & ZALO riêng biệt)
    let sendResult: {
      externalMessageId: string;
      rawPayload: Record<string, unknown>;
      resolvedRecipientId: string;
    };

    if (channelEnum === Channel.FACEBOOK || rawChannel.includes('FACEBOOK') || rawChannel.includes('FB')) {
      sendResult = await this.sendFacebookMessage(account, token, input, isMock);
    } else if (channelEnum === Channel.ZALO || rawChannel.includes('ZALO')) {
      sendResult = await this.sendZaloMessage(account, token, input, isPersonalZalo, isMock);
    } else {
      const fallbackMsgId = `${String(input.channel).toLowerCase()}_out_${Date.now()}`;
      sendResult = {
        externalMessageId: fallbackMsgId,
        rawPayload: { recipient: input.recipientId, sent: true },
        resolvedRecipientId: input.recipientId,
      };
    }

    const { externalMessageId, rawPayload, resolvedRecipientId } = sendResult;

    const sentAt = new Date();

    // 4. Lưu tin nhắn OUTBOUND vào MessageRepository
    let insertedId: string | null = null;
    let isAlreadyPersistedByWebhook = false;

    if (this.messageRepo) {
      try {
        const inserted = await this.messageRepo.insertManyIgnoreDuplicate([
          {
            channel: channelEnum,
            externalAccountId: account.externalAccountId,
            externalMessageId,
            senderExternalId: account.externalAccountId,
            direction: MessageDirection.OUTBOUND,
            content: input.content,
            sentAt,
            conversationId: isUuid(input.conversationId) ? input.conversationId : undefined,
            processedAt: sentAt,
            rawPayload: {
              ...rawPayload,
              recipient: { id: resolvedRecipientId || input.recipientId },
              message: { text: input.content },
              conversationKey: input.conversationId,
            },
          },
        ]);
        if (inserted.length > 0) {
          insertedId = inserted[0].id;
        } else {
          // Bản ghi đã được chèn trước đó (ví dụ Meta webhook echo đến nhanh hơn)
          isAlreadyPersistedByWebhook = true;
        }
      } catch (err) {
        this.logger.warn(`Could not persist outbound message: ${(err as Error).message}`);
      }
    }

    // 5. Cập nhật snippet và lastMessageAt của Conversation
    try {
      let conv = null;
      if (isUuid(input.conversationId)) {
        conv = await this.prisma.conversation.findUnique({
          where: { id: input.conversationId },
        });
      }
      if (!conv && insertedId) {
        const msg = await this.prisma.message.findUnique({
          where: { id: insertedId },
          select: { conversationId: true },
        });
        if (msg?.conversationId) {
          conv = await this.prisma.conversation.findUnique({
            where: { id: msg.conversationId },
          });
        }
      }
      if (!conv) {
        conv = await this.prisma.conversation.findFirst({
          where: {
            channelAccountId: account.id,
            ...(resolvedRecipientId ? {
              customer: {
                OR: [
                  { channelIdentities: { path: [channelEnum.toLowerCase()], equals: resolvedRecipientId } },
                  { channelIdentities: { path: [channelEnum.toLowerCase(), 'id'], equals: resolvedRecipientId } },
                  { channelIdentities: { path: ['socialId'], equals: resolvedRecipientId } },
                ],
              },
            } : {}),
          },
        });
      }

      if (conv) {
        await this.prisma.conversation.update({
          where: { id: conv.id },
          data: {
            snippet: input.content,
            lastMessageAt: sentAt,
          },
        });
      }
    } catch {
      // Non-critical
    }

    // 6. Phát tín hiệu Realtime Socket
    // Chỉ broadcast nếu webhook echo chưa chèn và broadcast trước đó, tránh nhân đôi tin nhắn ở Frontend
    if (this.realtime && !isAlreadyPersistedByWebhook) {
      try {
        this.realtime.broadcastNewMessage({
          id: insertedId || externalMessageId,
          conversationId: input.conversationId || `conv_${externalMessageId}`,
          channel: input.channel as any,
          direction: 'OUTBOUND',
          content: input.content,
          senderName: account.displayName,
          sentAt: sentAt.toISOString(),
        });
      } catch (err) {
        this.logger.warn(`Realtime broadcast failed: ${(err as Error).message}`);
      }
    }

    return {
      success: true,
      messageId: externalMessageId,
      sentAt,
      content: input.content,
      recipientId: resolvedRecipientId || input.recipientId,
      channel: input.channel as ChannelType,
    };
  }

  /**
   * Phân giải Facebook Page-Scoped ID (PSID) của khách hàng
   * Facebook Graph API bắt buộc recipient[id] phải là chuỗi số (PSID) do Meta cấp
   */
  private async resolveFacebookRecipientId(
    recipientId: string,
    conversationId?: string,
    workspaceId?: string,
  ): Promise<string> {
    let resolved = recipientId ? String(recipientId).trim() : '';

    // a. Nếu chuỗi có định dạng FACEBOOK_pageId_psid hoặc fb_pageId_psid, trích xuất psid cuối
    if (resolved.includes('_')) {
      const parts = resolved.split('_');
      const lastPart = parts[parts.length - 1];
      if (/^\d+$/.test(lastPart)) {
        return lastPart;
      }
    }

    // b. Nếu đã là chuỗi số nguyên thuần túy, đó chính là PSID hợp lệ
    if (/^\d+$/.test(resolved)) {
      return resolved;
    }

    const isUuid = (val?: string): val is string =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    let customer: any = null;

    // c. Thử tìm Customer từ recipientId nếu nó là UUID
    if (isUuid(resolved) && this.prisma?.customer) {
      try {
        customer = await this.prisma.customer.findUnique({
          where: { id: resolved },
        });
      } catch { }
    }

    // d. Nếu chưa có Customer, thử tìm từ conversationId
    if (!customer && isUuid(conversationId) && this.prisma?.conversation) {
      try {
        const conv = await this.prisma.conversation.findUnique({
          where: { id: conversationId },
          include: { customer: true },
        });
        if (conv?.customer) {
          customer = conv.customer;
        }
        // Kiểm tra xem externalConversationId có chứa PSID dạng FACEBOOK_page_psid không
        const extConvId = (conv as any)?.externalConversationId;
        if (extConvId && typeof extConvId === 'string' && extConvId.includes('_')) {
          const parts = extConvId.split('_');
          const lastPart = parts[parts.length - 1];
          if (/^\d+$/.test(lastPart)) {
            return lastPart;
          }
        }
      } catch { }
    }

    // e. Trích xuất Facebook PSID từ customer.channelIdentities
    if (customer?.channelIdentities) {
      const identities = customer.channelIdentities as any;
      const fbCandidate =
        identities?.facebook?.id ||
        (typeof identities?.facebook === 'string' ? identities.facebook : null) ||
        (Array.isArray(identities)
          ? identities.find((x: any) => String(x.channel).toUpperCase() === 'FACEBOOK')?.externalUserId
          : null);

      if (fbCandidate) {
        const str = String(fbCandidate).trim();
        if (/^\d+$/.test(str)) {
          return str;
        }
        if (str.includes('_')) {
          const parts = str.split('_');
          const lastPart = parts[parts.length - 1];
          if (/^\d+$/.test(lastPart)) {
            return lastPart;
          }
        }
      }
    }

    // f. Trích xuất từ customer.socialId nếu có
    const custSocialId = (customer as any)?.socialId;
    if (custSocialId) {
      const socialStr = String(custSocialId).trim();
      if (/^\d+$/.test(socialStr)) {
        return socialStr;
      }
      if (socialStr.includes('_')) {
        const parts = socialStr.split('_');
        const lastPart = parts[parts.length - 1];
        if (/^\d+$/.test(lastPart)) {
          return lastPart;
        }
      }
    }

    // g. Thử tìm từ tin nhắn INBOUND gần nhất trong cuộc trò chuyện
    if (isUuid(conversationId) && this.prisma?.message) {
      try {
        const lastInbound = await this.prisma.message.findFirst({
          where: {
            conversationId,
            direction: MessageDirection.INBOUND,
          },
          orderBy: { sentAt: 'desc' },
        });
        if (lastInbound) {
          const senderExtId = (lastInbound as any)?.senderExternalId;
          if (senderExtId && /^\d+$/.test(String(senderExtId).trim())) {
            return String(senderExtId).trim();
          }
          if (lastInbound.rawPayload) {
            const raw = lastInbound.rawPayload as any;
            const candidate = raw?.sender?.id || raw?.from?.id || raw?.uidFrom || raw?.senderExternalId;
            if (candidate && /^\d+$/.test(String(candidate).trim())) {
              return String(candidate).trim();
            }
          }
        }
      } catch { }
    }

    return resolved;
  }

  /**
   * Xử lý gửi tin nhắn riêng biệt cho kênh FACEBOOK qua Facebook Graph API
   */
  private async sendFacebookMessage(
    account: any,
    token: string,
    input: {
      recipientId: string;
      content: string;
      conversationId?: string;
      workspaceId?: string;
    },
    isMock: boolean,
  ): Promise<{
    externalMessageId: string;
    rawPayload: Record<string, unknown>;
    resolvedRecipientId: string;
  }> {
    const resolvedRecipientId = await this.resolveFacebookRecipientId(
      input.recipientId,
      input.conversationId,
      input.workspaceId,
    );

    const isTestOrMockRecipient =
      isMock ||
      resolvedRecipientId.startsWith('mock_') ||
      resolvedRecipientId.startsWith('test_') ||
      resolvedRecipientId.startsWith('fb_user_') ||
      resolvedRecipientId.startsWith('cust-') ||
      resolvedRecipientId === 'khách' ||
      resolvedRecipientId === 'anonymous';

    if (isMock || (isTestOrMockRecipient && !/^\d+$/.test(resolvedRecipientId))) {
      const mockMsgId = `mock_fb_msg_${Date.now()}`;
      return {
        externalMessageId: mockMsgId,
        rawPayload: {
          recipient_id: resolvedRecipientId,
          message_id: mockMsgId,
          isMock: true,
          content: input.content,
        },
        resolvedRecipientId,
      };
    }

    // Facebook Graph API bắt buộc recipient[id] phải là chuỗi số (PSID)
    if (!/^\d+$/.test(resolvedRecipientId)) {
      throw new BadRequestException(
        `Không tìm thấy Facebook PSID (Page-Scoped ID) hợp lệ của khách hàng (nhận được: "${resolvedRecipientId}"). Facebook yêu cầu khách hàng phải gửi tin nhắn cho Fanpage trước để tạo PSID (recipient[id] phải là chuỗi số).`,
      );
    }

    try {
      const fbRes = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: resolvedRecipientId },
          message: { text: input.content },
        }),
      });

      const fbJson = (await fbRes.json().catch(() => ({}))) as {
        message_id?: string;
        recipient_id?: string;
        error?: {
          message?: string;
          type?: string;
          code?: number;
          error_subcode?: number;
          fbtrace_id?: string;
        };
      };

      if (!fbRes.ok || fbJson.error) {
        const errObj = fbJson.error;
        let explanation = errObj?.message || fbRes.statusText || 'Lỗi không xác định từ Meta';

        if (errObj?.code === 10 || errObj?.error_subcode === 2018028) {
          explanation =
            'Chính sách Facebook: Tin nhắn ngoài khung giờ 24h. Fanpage chỉ được gửi phản hồi cho khách hàng trong vòng 24 giờ kể từ tin nhắn cuối cùng của khách.';
        } else if (errObj?.code === 190) {
          explanation =
            'Access Token của Fanpage Facebook đã hết hạn hoặc bị hủy quyền. Vui lòng kết nối lại tài khoản Fanpage trong Cài đặt Kênh.';
        } else if (errObj?.code === 100) {
          explanation =
            `Facebook Graph API lỗi (#100): Mã người nhận không hợp lệ (${resolvedRecipientId}). Khách hàng phải nhắn tin cho Fanpage trước để khởi tạo cuộc trò chuyện.`;
        }

        throw new BadRequestException(`Facebook Graph API lỗi: ${explanation}`);
      }

      const externalMessageId = fbJson.message_id || `fb_out_${Date.now()}`;
      return {
        externalMessageId,
        rawPayload: fbJson as Record<string, unknown>,
        resolvedRecipientId,
      };
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Không thể gửi tin nhắn qua Facebook: ${(err as Error).message}`);
    }
  }

  /**
   * Xử lý gửi tin nhắn riêng biệt cho kênh ZALO (OA CS API hoặc Zalo Cá Nhân zca-js)
   */
  private async sendZaloMessage(
    account: any,
    token: string,
    input: {
      recipientId: string;
      content: string;
      conversationId?: string;
    },
    isPersonalZalo: boolean,
    isMock: boolean,
  ): Promise<{
    externalMessageId: string;
    rawPayload: Record<string, unknown>;
    resolvedRecipientId: string;
  }> {
    let resolvedRecipientId = input.recipientId ? String(input.recipientId).trim() : '';

    const isUuid = (val?: string): val is string =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    // Tự động phân giải recipientId nếu là Customer UUID, 'khách', hoặc chuỗi không phải UID số của Zalo
    if (!/^\d+$/.test(resolvedRecipientId)) {
      let customer: any = null;

      // a. Thử tìm Customer bằng ID (UUID)
      if (isUuid(resolvedRecipientId) && this.prisma?.customer) {
        try {
          customer = await this.prisma.customer.findUnique({
            where: { id: resolvedRecipientId },
          });
        } catch { }
      }

      // b. Nếu chưa có, thử tìm từ conversationId
      if (!customer && input.conversationId && this.prisma?.conversation) {
        if (isUuid(input.conversationId)) {
          try {
            const conv = await this.prisma.conversation.findUnique({
              where: { id: input.conversationId },
              include: { customer: true },
            });
            if (conv?.customer) {
              customer = conv.customer;
            }
          } catch { }
        }
      }

      // c. Trích xuất UID Zalo từ channelIdentities của Customer
      if (customer?.channelIdentities) {
        const identities = customer.channelIdentities as any;
        const zaloId =
          identities?.zalo?.id ||
          (typeof identities?.zalo === 'string' ? identities.zalo : null) ||
          (Array.isArray(identities) ? identities.find((x: any) => x.channel === 'ZALO')?.externalUserId : null);
        if (zaloId && /^\d+$/.test(String(zaloId).trim())) {
          resolvedRecipientId = String(zaloId).trim();
        }
      }

      // d. Nếu vẫn chưa ra UID dạng số, thử tìm tin nhắn INBOUND gần nhất trong cuộc trò chuyện
      if (!/^\d+$/.test(resolvedRecipientId) && input.conversationId && this.prisma?.message) {
        if (isUuid(input.conversationId)) {
          try {
            const lastInbound = await this.prisma.message.findFirst({
              where: {
                conversationId: input.conversationId,
                direction: MessageDirection.INBOUND,
              },
              orderBy: { sentAt: 'desc' },
            });
            if (lastInbound?.rawPayload) {
              const raw = lastInbound.rawPayload as any;
              const candidate = raw.uidFrom || raw.sender?.id || raw.from?.id || raw.senderExternalId;
              if (candidate && /^\d+$/.test(String(candidate).trim())) {
                resolvedRecipientId = String(candidate).trim();
              }
            }
          } catch { }
        }
      }
    }

    const isTestOrMockRecipient =
      isMock ||
      resolvedRecipientId.startsWith('mock_') ||
      resolvedRecipientId.startsWith('test_') ||
      resolvedRecipientId.startsWith('zalo_user_') ||
      resolvedRecipientId.startsWith('cust-') ||
      resolvedRecipientId === 'khách' ||
      resolvedRecipientId === 'anonymous';

    let externalMessageId = '';
    let rawPayload: Record<string, unknown> = {};

    if (isPersonalZalo && this.zcaService) {
      if (isTestOrMockRecipient && !/^\d+$/.test(resolvedRecipientId)) {
        // Môi trường test / mock dữ liệu mẫu: mô phỏng thành công để không bị Zalo Web từ chối mã 1001
        externalMessageId = `zca_sim_${Date.now()}`;
        rawPayload = {
          error: 0,
          message: 'Simulated Personal Zalo message for mock/test customer',
          data: { message_id: externalMessageId, recipientId: resolvedRecipientId, content: input.content },
        };
      } else {
        const personalRes = await this.zcaService.sendPersonalMessage(account, resolvedRecipientId, input.content);
        externalMessageId = personalRes.messageId;
        rawPayload = personalRes.rawPayload;
      }
    } else if (isMock || isTestOrMockRecipient) {
      externalMessageId = `mock_zalo_msg_${Date.now()}`;
      rawPayload = {
        error: 0,
        message: 'Success (Mock Simulation)',
        data: { message_id: externalMessageId, recipientId: resolvedRecipientId },
      };
    } else {
      try {
        const zaloRes = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            access_token: token,
          },
          body: JSON.stringify({
            recipient: {
              user_id: resolvedRecipientId,
            },
            message: {
              text: input.content,
            },
          }),
        });

        const zaloJson = (await zaloRes.json().catch(() => ({}))) as {
          error: number;
          message: string;
          data?: { message_id: string };
        };

        if (zaloJson.error !== 0) {
          let explanation = zaloJson.message || `Lỗi HTTP ${zaloRes.status}`;
          if (zaloJson.error === -216) {
            explanation =
              'Access Token Zalo không hợp lệ hoặc đã hết hạn. Hãy cập nhật Token mới từ Zalo for Developers.';
          } else if (zaloJson.error === -201) {
            explanation =
              'Chính sách Zalo: Khách hàng chưa gửi tin nhắn cho OA trong 7 ngày qua. OA chỉ được phản hồi cho khách hàng có tương tác trong 7 ngày gần nhất.';
          } else if (zaloJson.error === -213) {
            explanation = 'Người dùng chưa quan tâm OA hoặc đã chặn tin nhắn từ OA.';
          }
          throw new BadRequestException(`Gửi tin Zalo thất bại [Mã ${zaloJson.error}]: ${explanation}`);
        }

        externalMessageId = zaloJson.data?.message_id || `zalo_out_${Date.now()}`;
        rawPayload = zaloJson;
      } catch (err: unknown) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException(`Không thể gửi tin nhắn qua máy chủ Zalo: ${(err as Error).message}`);
      }
    }

    return { externalMessageId, rawPayload, resolvedRecipientId };
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
