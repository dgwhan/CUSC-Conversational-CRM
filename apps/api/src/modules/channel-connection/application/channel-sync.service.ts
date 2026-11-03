import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
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
import { InboundEvent } from '../../messaging/domain/inbound-event.js';
import { Channel, MessageDirection } from '../../messaging/domain/channel.js';
import {
  resolveTagMappings,
  CRM_LEAD_STATUS,
  CRM_PIPELINE_STAGES,
  META_SOURCE_TAGS,
  tagSyncLogger,
  TAG_SYNC_STAGE,
  TAG_SYNC_ERROR_TYPE,
  TAG_EVENT_SOURCE,
} from '../../messaging/domain/tag-mapping/index.js';

export interface ChannelSyncResult {
  syncedCount: number;
  conversationsCount: number;
  pageName: string;
}

@Injectable()
export class ChannelSyncService {
  private readonly logger = new Logger(ChannelSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: TokenEncryptionService,
    @Optional() private readonly messageRepo?: MessageRepository,
    @Optional() private readonly realtime?: RealtimeService,
    @Optional() private readonly zcaService?: ZcaPersonalService,
    @Optional() @Inject(CUSTOMER_GATEWAY) private readonly customerGateway?: CustomerGateway,
  ) {}

  /**
   * Đồng bộ tin nhắn kênh (Tự động điều phối theo Zalo OA / Zalo Cá nhân hoặc Facebook Fanpage)
   */
  async syncChannel(
    channelAccountId: string,
    workspaceId?: string,
  ): Promise<ChannelSyncResult> {
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

    if (account.channel === Channel.ZALO) {
      return this.syncZaloMessages(account, workspaceId);
    }

    return this.syncFacebookMessages(channelAccountId, workspaceId);
  }

  /**
   * Đồng bộ tin nhắn và hội thoại gần nhất từ Zalo (Hỗ trợ Zalo OA & Zalo Cá nhân zca-js)
   */
  async syncZaloMessages(
    accountOrId: any,
    workspaceId?: string,
  ): Promise<ChannelSyncResult> {
    let account =
      typeof accountOrId === 'string'
        ? await this.prisma.channelAccount.findUnique({ where: { id: accountOrId } })
        : accountOrId;

    if (!account) {
      account = await this.prisma.channelAccount.findFirst({
        where: { externalAccountId: accountOrId },
      });
    }

    if (!account) {
      throw new NotFoundException(`Không tìm thấy tài khoản kênh Zalo`);
    }

    const targetWsId = account.workspaceId || workspaceId;
    const token = account.encryptedAccessToken
      ? this.encryption.decrypt(account.encryptedAccessToken)
      : '';

    const isPersonal = Boolean(
      (account.metadata as any)?.isPersonal ||
      (account.metadata as any)?.engine === 'zca-js' ||
      token?.trim().startsWith('{') ||
      token?.startsWith('zca_') ||
      account.externalAccountId.startsWith('zca_'),
    );

    if (isPersonal && !(account.metadata as any)?.isPersonal && this.prisma?.channelAccount) {
      this.prisma.channelAccount.update({
        where: { id: account.id },
        data: {
          metadata: {
            ...(account.metadata as any),
            isPersonal: true,
            engine: 'zca-js',
          },
        },
      }).catch(() => null);
    }

    this.logger.log(
      `Starting Zalo sync for "${account.displayName}" (${account.externalAccountId}, isPersonal: ${isPersonal})...`,
    );

    let totalMessagesSynced = 0;
    const syncedConversations: any[] = [];

    // 1. Nếu là Zalo OA: Gọi Zalo OpenAPI lấy các hội thoại gần nhất
    if (!isPersonal && token) {
      try {
        const res = await fetch('https://openapi.zalo.me/v2.0/oa/conversation?offset=0&count=20', {
          headers: { access_token: token },
        });
        if (res.ok) {
          const zaloData = (await res.json().catch(() => ({}))) as any;
          if (zaloData.error === 0 && Array.isArray(zaloData.data)) {
            syncedConversations.push(...zaloData.data);
          }
        }
      } catch (err) {
        this.logger.warn(`Could not fetch Zalo OA conversations: ${(err as Error).message}`);
      }
    }

    // 2. Nếu là Zalo Cá nhân zca-js có session đang hoạt động
    // Zalo Cá nhân (zca-js) nhận tin nhắn trực tiếp qua WebSocket event listener (`api.listener.on('message')`).
    // Đảm bảo listener đã được kích hoạt cho tài khoản này nếu chưa chạy
    if (isPersonal && this.zcaService) {
      const api = this.zcaService.getActiveApi(account.externalAccountId);
      if (api && typeof this.zcaService.isListenerActive === 'function' && !this.zcaService.isListenerActive(account.externalAccountId)) {
        this.zcaService.startListenerForApi(account.externalAccountId, api, account);
      }

      // Kéo tin nhắn và danh bạ cuộc trò chuyện từ Zalo Cloud
      if (typeof (this.zcaService as any).syncCloudMessages === 'function') {
        const cloudResult = await (this.zcaService as any).syncCloudMessages(account.externalAccountId);
        if (cloudResult.syncedCount > 0) {
          return {
            syncedCount: cloudResult.syncedCount,
            conversationsCount: cloudResult.conversationsCount,
            pageName: account.displayName,
          };
        }
      }
    }

    // 3. Nếu chưa có tin nhắn nào từ Zalo API, trả về syncedCount: 0 (Tuyệt đối không sinh dữ liệu giả mạo)
    if (syncedConversations.length === 0) {
      this.logger.log(`No new conversations to sync from Zalo for "${account.displayName}"`);
      return {
        syncedCount: 0,
        conversationsCount: 0,
        pageName: account.displayName,
      };
    }

    // 4. Lưu từng cuộc trò chuyện và tin nhắn vào Database
    for (const item of syncedConversations) {
      const customerZaloId = String(item.user_id || item.userId || item.id);
      const customerName =
        item.display_name || item.name || `Khách hàng Zalo #${customerZaloId.slice(-4)}`;
      const customerAvatar =
        item.avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(customerName)}&background=0068FF&color=fff&bold=true`;
      const lastMsgText = item.last_message?.text || item.snippet || 'Quan tâm thông tin khóa học';
      const lastMsgTime = item.last_message?.time ? new Date(item.last_message.time) : new Date();

      // Lưu Customer
      let dbCustomer: any = null;
      if (this.prisma.customer) {
        try {
          dbCustomer = await this.prisma.customer.findFirst({
            where: {
              workspaceId: targetWsId,
              OR: [
                { channelIdentities: { path: ['zalo', 'id'], equals: customerZaloId } },
                { channelIdentities: { path: ['zalo'], equals: customerZaloId } },
                { channelIdentities: { path: ['socialId'], equals: customerZaloId } },
                ...(customerName && !customerName.startsWith('Khách hàng') ? [{ fullName: customerName }] : []),
              ],
            },
          });

          if (!dbCustomer) {
            dbCustomer = await this.prisma.customer.create({
              data: {
                workspaceId: targetWsId,
                fullName: customerName,
                avatarUrl: customerAvatar,
                channelIdentities: {
                  zalo: { id: customerZaloId, name: customerName },
                },
                leadStage: 'STAGE_NEW',
              },
            });
          }
        } catch (err) {
          this.logger.warn(`Could not save customer for Zalo sync: ${(err as Error).message}`);
        }
      }

      // Tự động tìm hoặc tạo Contact & ChannelIdentity chuẩn hóa đa kênh
      if (this.customerGateway && customerZaloId) {
        try {
          await this.customerGateway.findOrCreate({
            channel: Channel.ZALO,
            senderExternalId: customerZaloId,
            displayName: customerName,
            rawPayload: {
              customerName,
              customerAvatar,
              user_id: customerZaloId,
            },
          });
        } catch (gatewayErr) {
          this.logger.warn(`Could not findOrCreate contact for Zalo user ${customerZaloId}: ${(gatewayErr as Error).message}`);
        }
      }

      // Lưu Conversation
      let dbConv: any = null;
      if (this.prisma.conversation) {
        try {
          dbConv = await this.prisma.conversation.findFirst({
            where: {
              channelAccountId: account.id,
              customerId: dbCustomer?.id,
            },
          });

          if (!dbConv) {
            dbConv = await this.prisma.conversation.create({
              data: {
                workspaceId: targetWsId,
                channelAccountId: account.id,
                customerId: dbCustomer?.id,
                snippet: lastMsgText,
                lastMessageAt: lastMsgTime,
              },
            });
          } else {
            await this.prisma.conversation.update({
              where: { id: dbConv.id },
              data: {
                snippet: lastMsgText,
                lastMessageAt: lastMsgTime,
              },
            });
          }
        } catch (err) {
          this.logger.warn(`Could not save conversation for Zalo sync: ${(err as Error).message}`);
        }
      }

      // Lưu Message INBOUND
      const event: InboundEvent = {
        channel: Channel.ZALO,
        externalMessageId:
          item.last_message?.message_id || `zalo_in_${Date.now()}_${customerZaloId}`,
        externalAccountId: account.externalAccountId,
        senderExternalId: customerZaloId,
        content: lastMsgText,
        sentAt: lastMsgTime,
        direction: MessageDirection.INBOUND,
        conversationId: dbConv?.id,
        processedAt: lastMsgTime,
        rawPayload: {
          ...item,
          customerName,
          customerAvatar,
          customerId: dbCustomer?.id,
          conversationId: dbConv?.id,
          isPersonal,
        },
        workspaceId: targetWsId,
      };

      if (this.messageRepo) {
        const created = await this.messageRepo.insertManyIgnoreDuplicate([event]);
        totalMessagesSynced += created.length;

        // Bắn sự kiện Realtime WebSocket về Unified Inbox
        if (this.realtime && created.length > 0) {
          const convKey = dbConv?.id || `ZALO_${account.externalAccountId}_${customerZaloId}`;
          this.realtime.broadcastNewMessage({
            id: created[0].id,
            conversationId: convKey,
            channel: 'ZALO',
            direction: 'INBOUND',
            content: lastMsgText,
            senderName: customerName,
            senderAvatar: customerAvatar,
            sentAt: lastMsgTime.toLocaleTimeString(),
            customerPhone: dbCustomer?.phone || '',
            customerEmail: dbCustomer?.email || '',
          });

          if (dbCustomer) {
            this.realtime.broadcastPipelineChange({
              customerId: dbCustomer.id,
              customerName: customerName,
              previousStage: '',
              newStage: 'STAGE_NEW',
              updatedBy: isPersonal ? 'Zalo Personal Sync' : 'Zalo OA Sync',
            });
          }
        }
      }
    }

    this.logger.log(
      `Synced ${totalMessagesSynced} Zalo messages across ${syncedConversations.length} conversations for ${account.displayName}`,
    );

    return {
      syncedCount: totalMessagesSynced,
      conversationsCount: syncedConversations.length,
      pageName: account.displayName,
    };
  }

  /**
   * Đồng bộ tin nhắn từ Facebook Graph API cho một ChannelAccount đã kết nối
   */
  async syncFacebookMessages(
    channelAccountId: string,
    workspaceId?: string,
  ): Promise<ChannelSyncResult> {
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
      tagSyncLogger.logError({
        stage: TAG_SYNC_STAGE.READ,
        errorType: TAG_SYNC_ERROR_TYPE.TAG_READ_ERROR,
        message: `Lỗi đọc hội thoại và nhãn phân loại từ Meta Graph API: ${msg}`,
        eventSource: TAG_EVENT_SOURCE.META_GRAPH_API,
        channel: Channel.FACEBOOK,
        channelAccountId: account.id,
        metadata: {
          pageId,
          url, // Tự động làm sạch access token bởi tagSyncLogger
          status: res.status,
          errorJson: errJson,
        },
      });
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

      // 2. Tra cứu khách hàng và cuộc hội thoại đã tồn tại để lấy context đồng bộ tag
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
        } catch { }
      }

      let dbConv: any = null;
      if (this.prisma.conversation) {
        try {
          dbConv = await this.prisma.conversation.findFirst({
            where: {
              channelAccountId: account.id,
              ...(dbCustomer ? { customerId: dbCustomer.id } : {}),
            },
          });
        } catch { }
      }

      // 3. Ánh xạ tag nguồn từ Meta Business Suite sang tag nội bộ CRM (Facebook Lead -> Lead)
      const convTime = new Date(conv.updated_time || Date.now());
      const hasLabelsData = Array.isArray(conv.labels?.data);
      const rawSourceTags: string[] = fbLabels.length > 0
        ? fbLabels
        : (hasLabelsData ? [] : [META_SOURCE_TAGS.FACEBOOK_LEAD]);
      const isCustomerTouched = dbCustomer
        ? (dbCustomer.leadStatus !== CRM_LEAD_STATUS.NEW && dbCustomer.leadStatus !== 'NEW')
        : false;
      const customerIdentities = (dbCustomer?.channelIdentities as any) || {};
      const manuallyRemovedTags: string[] = Array.isArray(customerIdentities.manuallyRemovedTags)
        ? customerIdentities.manuallyRemovedTags
        : [];

      const tagMappingResult = resolveTagMappings({
        channel: Channel.FACEBOOK,
        currentTags: dbConv?.tags || [],
        sourceTags: rawSourceTags,
        isCustomerTouched,
        existingLeadStatus: dbCustomer?.leadStatus,
        existingLeadStage: dbCustomer?.leadStage,
        eventTimestamp: convTime,
        lastSyncTimestamp: dbConv?.lastMessageAt || dbCustomer?.updatedAt,
        explicitEmptyLabels: hasLabelsData && conv.labels.data.length === 0,
        manuallyRemovedTags,
      });

      const convTags = tagMappingResult.finalTags;
      let isNewCustomer = false;

      // 4. ĐỔ DỮ LIỆU KHÁCH HÀNG VÀO BẢNG "customers" TRONG DATABASE
      if (customer?.id && this.prisma.customer) {
        try {
          if (!dbCustomer) {
            dbCustomer = await this.prisma.customer.create({
              data: {
                workspaceId: targetWsId || null,
                fullName: customerName,
                email: customer.email || null,
                avatarUrl: customerAvatar,
                leadStatus: tagMappingResult.suggestedLeadStatus || CRM_LEAD_STATUS.POTENTIAL,
                leadStage: tagMappingResult.suggestedLeadStage || CRM_PIPELINE_STAGES.STAGE_NEW,
                channelIdentities: {
                  facebook: customer.id,
                  channel: 'FACEBOOK',
                  pageId,
                  tags: convTags,
                },
              },
            });
            isNewCustomer = true;
            this.logger.log(`Tự động tạo mới bản ghi Customer vào DB: "${customerName}" (${dbCustomer.id}) với tag ${convTags.join(', ')}`);
          } else {
            const shouldUpgradeStatus =
              tagMappingResult.shouldUpgradeLead &&
              Boolean(tagMappingResult.suggestedLeadStatus);
            const existingIdentities = (dbCustomer.channelIdentities as any) || {};

            dbCustomer = await this.prisma.customer.update({
              where: { id: dbCustomer.id },
              data: {
                fullName: customerName,
                avatarUrl: customerAvatar || dbCustomer.avatarUrl,
                ...(shouldUpgradeStatus
                  ? {
                    leadStatus: tagMappingResult.suggestedLeadStatus,
                    leadStage: tagMappingResult.suggestedLeadStage || dbCustomer.leadStage || CRM_PIPELINE_STAGES.STAGE_NEW,
                  }
                  : {}),
                channelIdentities: {
                  ...existingIdentities,
                  facebook: customer.id,
                  channel: 'FACEBOOK',
                  pageId,
                  tags: convTags,
                },
              },
            });
          }
        } catch (err) {
          this.logger.warn(`Could not save customer to DB: ${(err as Error).message}`);
          tagSyncLogger.logError({
            stage: TAG_SYNC_STAGE.UPDATE,
            errorType: TAG_SYNC_ERROR_TYPE.TAG_DATABASE_ERROR,
            message: `Không thể lưu thông tin và nhãn khách hàng vào CSDL: ${(err as Error).message}`,
            eventSource: TAG_EVENT_SOURCE.META_GRAPH_API,
            channel: Channel.FACEBOOK,
            customerId: dbCustomer?.id,
            sourceTags: rawSourceTags,
            targetTags: convTags,
            channelAccountId: account.id,
            error: err,
          });
        }
      }

      // Tự động tìm hoặc tạo Contact & ChannelIdentity chuẩn hóa đa kênh
      if (this.customerGateway && customer?.id) {
        try {
          await this.customerGateway.findOrCreate({
            channel: Channel.FACEBOOK,
            senderExternalId: customer.id,
            displayName: customerName,
            rawPayload: {
              customerName,
              customerAvatar,
              email: customer.email,
              sender: { id: customer.id, name: customerName },
            },
          });
        } catch (gatewayErr) {
          this.logger.warn(`Could not findOrCreate contact for Facebook user ${customer.id}: ${(gatewayErr as Error).message}`);
        }
      }

      // 5. ĐỔ DỮ LIỆU CUỘC HỘI THOẠI VÀO BẢNG "conversations" TRONG DATABASE
      if (this.prisma.conversation) {
        try {
          const latestMsg = messagesList.find((m: any) => m.message)?.message || 'Cuộc trò chuyện Facebook';

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
            const isOutOfOrder = Boolean(
              dbConv.lastMessageAt && convTime.getTime() < new Date(dbConv.lastMessageAt).getTime()
            );

            dbConv = await this.prisma.conversation.update({
              where: { id: dbConv.id },
              data: {
                ...(isOutOfOrder ? {} : {
                  snippet: latestMsg,
                  lastMessageAt: convTime,
                }),
                tags: convTags,
                ...(dbCustomer && !dbConv.customerId ? { customerId: dbCustomer.id } : {}),
              },
            });
          }
        } catch (err) {
          this.logger.warn(`Could not save conversation to DB: ${(err as Error).message}`);
          tagSyncLogger.logError({
            stage: TAG_SYNC_STAGE.UPDATE,
            errorType: TAG_SYNC_ERROR_TYPE.TAG_DATABASE_ERROR,
            message: `Không thể lưu nhãn cuộc hội thoại vào CSDL: ${(err as Error).message}`,
            eventSource: TAG_EVENT_SOURCE.META_GRAPH_API,
            channel: Channel.FACEBOOK,
            conversationId: dbConv?.id,
            customerId: dbCustomer?.id,
            sourceTags: rawSourceTags,
            targetTags: convTags,
            channelAccountId: account.id,
            error: err,
          });
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
          conversationId: dbConv?.id,
          processedAt: new Date(m.created_time),
          attachments: m.attachments?.data || undefined,
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
                sentAt: new Date(ev.sentAt).toISOString(),
                customerPhone: dbCustomer?.phone || '',
                customerEmail: dbCustomer?.email || customer?.email || '',
              });
            }
          }

          // Tự động đẩy sự kiện cập nhật Phễu Kanban chỉ khi khách hàng mới tạo (tránh reset khách hàng cũ)
          if (isNewCustomer && dbCustomer) {
            this.realtime.broadcastPipelineChange({
              customerId: dbCustomer.id,
              customerName: customerName,
              previousStage: '',
              newStage: dbCustomer.leadStage || 'STAGE_NEW',
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
}

