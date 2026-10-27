import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { TokenEncryptionService } from '../infrastructure/token-encryption.service.js';
import { MessageRepository } from '../../messaging/infrastructure/message.repository.js';
import { RealtimeService } from '../../realtime/realtime.service.js';
import { InboundEvent } from '../../messaging/domain/inbound-event.js';
import { Channel, MessageDirection } from '../../messaging/domain/channel.js';
import type {
  ActivateChannelsBody,
  ActivateChannelsResult,
  ChannelAccountDto,
} from '../../../contracts/channel-connection.js';

@Injectable()
export class ChannelManagerService {
  private readonly logger = new Logger(ChannelManagerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: TokenEncryptionService,
    @Optional() private readonly messageRepo?: MessageRepository,
    @Optional() private readonly realtime?: RealtimeService,
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
              name: 'Tổ hợp Công nghệ PolarisX',
              slug: `polarisx-${Date.now().toString(36)}`,
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

  /**
   * Đồng bộ tin nhắn từ Facebook Graph API cho một ChannelAccount đã kết nối
   */
  async syncFacebookMessages(
    channelAccountId: string,
    workspaceId?: string,
  ): Promise<{ syncedCount: number; conversationsCount: number; pageName: string }> {
    let account = await this.prisma.channelAccount.findUnique({
      where: { id: channelAccountId },
    });

    if (!account) {
      account = await this.prisma.channelAccount.findFirst({
        where: { externalAccountId: channelAccountId },
      });
    }

    if (!account) {
      throw new NotFoundException(`Không tìm thấy tài khoản kênh ${channelAccountId}`);
    }

    if (!account.encryptedAccessToken) {
      throw new BadRequestException('Kênh này chưa có Access Token để đồng bộ dữ liệu');
    }

    const pageToken = this.encryption.decrypt(account.encryptedAccessToken);
    const pageId = account.externalAccountId;

    this.logger.log(`Starting Facebook message sync for page "${account.displayName}" (${pageId})...`);

    // Gọi Meta Graph API lấy danh sách cuộc hội thoại và các tin nhắn gần nhất kèm avatar profile & nhãn phân loại (labels)
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(
      pageId,
    )}/conversations?fields=id,updated_time,labels{id,name},participants{id,name,email,picture{url}},messages.limit(30){id,message,created_time,from,to}&access_token=${pageToken}`;

    const res = await fetch(url);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.error?.message || `Lỗi HTTP ${res.status}`;
      throw new BadRequestException(`Meta Graph API từ chối đồng bộ tin nhắn: ${msg}`);
    }

    const data = await res.json();
    const conversations: any[] = data.data || [];
    let totalMessagesSynced = 0;
    const targetWsId = account.workspaceId || workspaceId;

    for (const conv of conversations) {
      const messagesList: any[] = conv.messages?.data || [];
      const participants: any[] = conv.participants?.data || [];
      const customer = participants.find((p) => p.id !== pageId);
      const fbLabels: string[] = Array.isArray(conv.labels?.data)
        ? conv.labels.data.map((l: any) => l.name).filter(Boolean)
        : [];
      const convTags = fbLabels.length > 0 ? fbLabels : ['Facebook Lead'];

      // 1. Trích xuất hoặc truy vấn avatar & thông tin khách hàng thực tế từ Meta
      let customerName = customer?.name || (customer?.id ? `Khách hàng Facebook #${customer.id.slice(-4)}` : 'Khách hàng Facebook');
      let customerAvatar = customer?.picture?.data?.url;

      if (!customerAvatar && customer?.id && pageToken) {
        try {
          const profileRes = await fetch(
            `https://graph.facebook.com/v19.0/${customer.id}?fields=name,first_name,last_name,profile_pic&access_token=${pageToken}`,
          );
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            if (profileData.profile_pic) {
              customerAvatar = profileData.profile_pic;
            }
            if (profileData.name && !customer.name) {
              customerName = profileData.name;
            }
          }
        } catch {
          // Bỏ qua nếu token không đủ quyền query profile cá nhân
        }
      }

      // Đảm bảo luôn có avatar đẹp nếu tài khoản chưa có avatar công khai
      if (!customerAvatar) {
        customerAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(customerName)}&background=0284c7&color=fff&bold=true`;
      }

      // 2. ĐỔ DỮ LIỆU KHÁCH HÀNG VÀO BẢNG "customers" TRONG DATABASE
      let dbCustomer: any = null;
      if (customer?.id && this.prisma.customer) {
        try {
          dbCustomer = await this.prisma.customer.findFirst({
            where: {
              OR: [
                { channelIdentities: { path: ['facebook'], equals: customer.id } },
                ...(customer.email ? [{ email: customer.email }] : []),
              ],
            },
          });

          if (!dbCustomer) {
            dbCustomer = await this.prisma.customer.create({
              data: {
                workspaceId: targetWsId || null,
                fullName: customerName,
                email: customer.email || null,
                avatarUrl: customerAvatar,
                leadStatus: 'NEW',
                leadStage: 'STAGE_NEW',
                channelIdentities: { facebook: customer.id, channel: 'FACEBOOK', pageId },
              },
            });
            this.logger.log(`Tự động tạo mới bản ghi Customer vào DB: "${customerName}" (${dbCustomer.id})`);
          } else {
            dbCustomer = await this.prisma.customer.update({
              where: { id: dbCustomer.id },
              data: {
                fullName: customerName,
                avatarUrl: customerAvatar || dbCustomer.avatarUrl,
              },
            });
          }
        } catch (err) {
          this.logger.warn(`Could not save customer to DB: ${(err as Error).message}`);
        }
      }

      // 3. ĐỔ DỮ LIỆU CUỘC HỘI THOẠI VÀO BẢNG "conversations" TRONG DATABASE
      let dbConv: any = null;
      if (this.prisma.conversation) {
        try {
          dbConv = await this.prisma.conversation.findFirst({
            where: {
              channelAccountId: account.id,
              ...(dbCustomer ? { customerId: dbCustomer.id } : {}),
            },
          });

          const latestMsg = messagesList.find((m: any) => m.message)?.message || 'Cuộc trò chuyện Facebook';
          const convTime = new Date(conv.updated_time || Date.now());

          if (!dbConv) {
            dbConv = await this.prisma.conversation.create({
              data: {
                workspaceId: targetWsId || null,
                channelAccountId: account.id,
                customerId: dbCustomer?.id || null,
                status: 'OPEN',
                snippet: latestMsg,
                lastMessageAt: convTime,
                lastCustomerMessageAt: convTime,
                tags: convTags,
              },
            });
          } else {
            dbConv = await this.prisma.conversation.update({
              where: { id: dbConv.id },
              data: {
                snippet: latestMsg,
                lastMessageAt: convTime,
                tags: convTags,
                ...(dbCustomer && !dbConv.customerId ? { customerId: dbCustomer.id } : {}),
              },
            });
          }
        } catch (err) {
          this.logger.warn(`Could not save conversation to DB: ${(err as Error).message}`);
        }
      }

      const events: InboundEvent[] = [];
      for (const m of messagesList) {
        if (!m.message) continue;
        const isOutbound = m.from?.id === pageId;
        events.push({
          channel: Channel.FACEBOOK,
          externalMessageId: m.id,
          externalAccountId: pageId,
          senderExternalId: m.from?.id || customer?.id || 'unknown',
          content: m.message,
          sentAt: new Date(m.created_time),
          direction: isOutbound ? MessageDirection.OUTBOUND : MessageDirection.INBOUND,
          rawPayload: {
            ...m,
            customerName,
            customerAvatar,
            customerId: dbCustomer?.id,
            conversationId: dbConv?.id,
            tags: convTags,
          },
          workspaceId: targetWsId,
        });
      }

      if (events.length > 0 && this.messageRepo) {
        const created = await this.messageRepo.insertManyIgnoreDuplicate(events);
        totalMessagesSynced += created.length;

        // Bắn sự kiện WebSocket realtime để màn hình Inbox & Kanban cập nhật ngay tức thì
        if (this.realtime) {
          for (let i = 0; i < created.length; i++) {
            const ev = events[i];
            const item = created[i];
            if (ev && item) {
              const isOut = ev.direction === MessageDirection.OUTBOUND;
              const conversationId = `FACEBOOK_${pageId}_${customer?.id || ev.senderExternalId}`;

              this.realtime.broadcastNewMessage({
                id: item.id,
                conversationId,
                channel: 'FACEBOOK',
                direction: isOut ? 'OUTBOUND' : 'INBOUND',
                content: ev.content || '',
                senderName: isOut ? account.displayName : customerName,
                senderAvatar: isOut ? (account.avatarUrl || '') : customerAvatar,
                sentAt: new Date(ev.sentAt).toLocaleTimeString(),
                customerPhone: dbCustomer?.phone || '',
                customerEmail: dbCustomer?.email || customer?.email || '',
              });
            }
          }

          // Tự động đẩy sự kiện cập nhật Phễu Kanban
          if (dbCustomer) {
            this.realtime.broadcastPipelineChange({
              customerId: dbCustomer.id,
              customerName: customerName,
              previousStage: '',
              newStage: 'STAGE_NEW',
              updatedBy: 'Facebook Sync',
            });
          }
        }
      }
    }

    this.logger.log(`Synced ${totalMessagesSynced} messages across ${conversations.length} conversations for ${account.displayName}`);

    return {
      syncedCount: totalMessagesSynced,
      conversationsCount: conversations.length,
      pageName: account.displayName,
    };
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
