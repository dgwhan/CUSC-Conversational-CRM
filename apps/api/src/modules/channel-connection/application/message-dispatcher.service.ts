import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { TokenEncryptionService } from '../infrastructure/token-encryption.service.js';
import { ZcaPersonalService } from './zca-personal.service.js';
import { MessageRepository } from '../../messaging/infrastructure/message.repository.js';
import { RealtimeService } from '../../realtime/realtime.service.js';
import { Channel, MessageDirection } from '../../messaging/domain/channel.js';
import type {
  ChannelType,
} from '../../../contracts/channel-connection.js';

export interface SendMessageInput {
  channel: ChannelType | Channel;
  recipientId: string;
  content: string;
  channelAccountId?: string;
  conversationId?: string;
  workspaceId?: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId: string;
  sentAt: Date;
  content: string;
  recipientId: string;
  channel: ChannelType;
}

@Injectable()
export class MessageDispatcherService {
  private readonly logger = new Logger(MessageDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: TokenEncryptionService,
    @Optional() private readonly messageRepo?: MessageRepository,
    @Optional() private readonly realtime?: RealtimeService,
    @Optional() private readonly zcaService?: ZcaPersonalService,
  ) {}

  /**
   * Gửi tin nhắn phản hồi đa kênh (Facebook Graph API, Zalo OpenAPI, Zalo Cá nhân zca-js)
   */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const rawChannel = String(input.channel || '').toUpperCase();
    const isPersonalZaloRequested = rawChannel === 'ZALO_PERSONAL' || rawChannel.includes('PERSONAL');

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

    // 1. Tìm tài khoản kênh tương ứng
    let account = null;
    if (input.channelAccountId) {
      try {
        account = await this.prisma.channelAccount.findUnique({
          where: { id: input.channelAccountId },
        });
      } catch {
        // Fallback nếu channelAccountId không hợp lệ với database
      }
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
      const findAccountWithWorkspace = async (wsId?: string) => {
        const wsFilter = wsId ? { workspaceId: wsId } : {};
        if (isPersonalZaloRequested) {
          const accounts = await this.prisma.channelAccount.findMany({
            where: {
              channel: channelEnum,
              isActive: true,
              ...wsFilter,
            },
            orderBy: { updatedAt: 'desc' },
          });
          return (
            accounts.find((acc) => {
              const meta = acc.metadata as any;
              return (
                meta?.isPersonal ||
                meta?.engine === 'zca-js' ||
                acc.externalAccountId?.startsWith('zca_')
              );
            }) ||
            accounts[0] ||
            null
          );
        }
        return this.prisma.channelAccount.findFirst({
          where: {
            channel: channelEnum,
            isActive: true,
            ...wsFilter,
          },
          orderBy: { updatedAt: 'desc' },
        });
      };

      try {
        account = await findAccountWithWorkspace(input.workspaceId);
      } catch {
        account = await findAccountWithWorkspace(undefined);
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

    let externalMessageId = '';
    let rawPayload: Record<string, unknown> = {};

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
            ...(account.metadata as any),
            isPersonal: true,
            engine: 'zca-js',
          },
        },
      }).catch(() => null);
    }

    if ((channelEnum === Channel.ZALO || input.channel === 'ZALO') && this.zcaService) {
      await this.zcaService.enforceRateLimitAndSafety(account.id, input.recipientId, isPersonalZalo);
    }

    // 3. Gửi tin nhắn qua Zalo Open API hoặc zca-js Engine
    if (channelEnum === Channel.ZALO || input.channel === 'ZALO') {
      let resolvedRecipientId = input.recipientId ? String(input.recipientId).trim() : '';

      const isPotentialPhone =
        Boolean(resolvedRecipientId) &&
        ((resolvedRecipientId.startsWith('+84') && resolvedRecipientId.length >= 10 && resolvedRecipientId.length <= 14) ||
         (resolvedRecipientId.startsWith('84') && resolvedRecipientId.length >= 9 && resolvedRecipientId.length <= 13) ||
         (resolvedRecipientId.startsWith('0') && resolvedRecipientId.length >= 9 && resolvedRecipientId.length <= 12));

      // Tự động phân giải recipientId nếu là Customer UUID, 'khách', hoặc số điện thoại danh bạ
      const needsResolution = !/^\d+$/.test(resolvedRecipientId) || isPotentialPhone;

      if (needsResolution) {
        let customer: any = null;

        // a. Thử tìm Customer bằng ID (UUID)
        if (resolvedRecipientId && this.prisma?.customer) {
          try {
            customer = await this.prisma.customer.findUnique({
              where: { id: resolvedRecipientId },
            });
          } catch { }
        }

        // a2. Thử tìm Customer bằng số điện thoại nếu resolvedRecipientId là phone
        if (!customer && isPotentialPhone && this.prisma?.customer) {
          try {
            const rawDigits = resolvedRecipientId.replace(/\D/g, '');
            const phoneNoLeadingZero = rawDigits.startsWith('84') ? '0' + rawDigits.slice(2) : rawDigits;
            customer = await this.prisma.customer.findFirst({
              where: {
                OR: [
                  { phone: { in: [resolvedRecipientId, phoneNoLeadingZero, rawDigits] } },
                  { channelIdentities: { path: ['phone'], equals: resolvedRecipientId } },
                ],
              },
            });
          } catch { }
        }

        // b. Nếu chưa có, thử tìm từ conversationId
        if (!customer && input.conversationId && this.prisma?.conversation) {
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

        // d. Nếu vẫn là số điện thoại hoặc chưa ra UID, thử tìm tin nhắn INBOUND gần nhất trong cuộc trò chuyện
        const stillPhoneOrUnresolved = !/^\d+$/.test(resolvedRecipientId) || isPotentialPhone;
        if (stillPhoneOrUnresolved && input.conversationId && this.prisma?.message) {
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

      const isTestOrMockRecipient =
        isMock ||
        resolvedRecipientId.startsWith('mock_') ||
        resolvedRecipientId.startsWith('test_') ||
        resolvedRecipientId.startsWith('zalo_user_') ||
        resolvedRecipientId.startsWith('cust-') ||
        resolvedRecipientId === 'khách' ||
        resolvedRecipientId === 'anonymous';

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
    } else if (channelEnum === Channel.FACEBOOK || input.channel === 'FACEBOOK') {
      // Facebook Graph API
      if (isMock) {
        externalMessageId = `mock_fb_msg_${Date.now()}`;
        rawPayload = { recipient_id: input.recipientId, message_id: externalMessageId };
      } else {
        try {
          const fbRes = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: input.recipientId },
              message: { text: input.content },
            }),
          });
          const fbJson = await fbRes.json().catch(() => ({}));
          if (!fbRes.ok || fbJson.error) {
            throw new BadRequestException(`Facebook Graph API lỗi: ${fbJson.error?.message || fbRes.statusText}`);
          }
          externalMessageId = fbJson.message_id || `fb_out_${Date.now()}`;
          rawPayload = fbJson;
        } catch (err: unknown) {
          if (err instanceof BadRequestException) throw err;
          throw new BadRequestException(`Không thể gửi tin nhắn Facebook: ${(err as Error).message}`);
        }
      }
    } else {
      externalMessageId = `${String(input.channel).toLowerCase()}_out_${Date.now()}`;
      rawPayload = { recipient: input.recipientId, sent: true };
    }

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
            conversationId: input.conversationId,
            processedAt: sentAt,
            rawPayload: {
              ...rawPayload,
              recipient: { id: input.recipientId },
              message: { text: input.content },
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
      const conv = await this.prisma.conversation.findFirst({
        where: {
          channelAccountId: account.id,
          ...(input.conversationId ? { id: input.conversationId } : {}),
        },
      });
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
      recipientId: input.recipientId,
      channel: input.channel as ChannelType,
    };
  }

  async markFacebookConversationSeen(conversationId: string, workspaceId?: string): Promise<void> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)) {
      throw new BadRequestException('conversationId không hợp lệ');
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        channelAccount: true,
        customer: true,
        messages: {
          where: { direction: MessageDirection.INBOUND },
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: { rawPayload: true },
        },
      },
    });

    if (
      !conversation ||
      (workspaceId &&
        conversation.workspaceId !== workspaceId &&
        conversation.channelAccount.workspaceId !== workspaceId)
    ) {
      throw new NotFoundException('Không tìm thấy hội thoại');
    }
    if (conversation.channelAccount.channel !== Channel.FACEBOOK) {
      throw new BadRequestException('Chỉ hỗ trợ đồng bộ trạng thái đã xem cho hội thoại Facebook');
    }
    if (!conversation.channelAccount.encryptedAccessToken) {
      throw new BadRequestException('Fanpage chưa có Access Token để đồng bộ trạng thái đã xem');
    }

    const identities = conversation.customer?.channelIdentities;
    const identityMap =
      identities && typeof identities === 'object' && !Array.isArray(identities)
        ? (identities as Record<string, unknown>)
        : undefined;
    const facebookIdentity = identityMap?.facebook;
    const identityRecipient =
      typeof facebookIdentity === 'string'
        ? facebookIdentity
        : facebookIdentity && typeof facebookIdentity === 'object' && !Array.isArray(facebookIdentity)
          ? (facebookIdentity as Record<string, unknown>).id
          : undefined;

    const latestInboundPayload = conversation.messages[0]?.rawPayload;
    const inboundMap =
      latestInboundPayload && typeof latestInboundPayload === 'object' && !Array.isArray(latestInboundPayload)
        ? (latestInboundPayload as Record<string, unknown>)
        : undefined;
    const sender = inboundMap?.sender;
    const senderId =
      sender && typeof sender === 'object' && !Array.isArray(sender)
        ? (sender as Record<string, unknown>).id
        : undefined;
    const recipientId =
      (typeof identityRecipient === 'string' && identityRecipient) ||
      (typeof senderId === 'string' && senderId) ||
      (typeof inboundMap?.senderExternalId === 'string' && inboundMap.senderExternalId);

    if (!recipientId) {
      throw new BadRequestException('Không thể xác định Facebook PSID của khách hàng trong hội thoại');
    }

    const token = this.encryption.decrypt(conversation.channelAccount.encryptedAccessToken);
    if (!token) {
      throw new BadRequestException('Không thể giải mã Access Token của Fanpage. Vui lòng kết nối lại tài khoản.');
    }

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(conversation.channelAccount.externalAccountId)}/messages?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          sender_action: 'mark_seen',
        }),
      },
    );
    const result = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    if (!response.ok || result.error) {
      throw new BadRequestException(
        `Không thể đồng bộ trạng thái đã xem lên Facebook: ${result.error?.message || response.statusText}`,
      );
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
  }
}
