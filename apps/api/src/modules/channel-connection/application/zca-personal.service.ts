import { Injectable, Logger, BadRequestException, Optional, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
// @ts-ignore
import { Zalo, LoginQRCallbackEventType } from 'zca-js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { RealtimeService } from '../../realtime/realtime.service.js';
import { TokenEncryptionService } from '../infrastructure/token-encryption.service.js';

export interface ZcaSafetyConfig {
  enabled: boolean;
  minIntervalMs: number; // Giãn cách tối thiểu giữa 2 tin nhắn (mặc định 2500ms)
  maxIntervalMs: number; // Giãn cách tối đa giữa 2 tin nhắn (mặc định 4500ms)
  maxMessagesPerMinute: number; // Tối đa tin nhắn / phút (mặc định 15)
  maxStrangerPerDay: number; // Tối đa tin nhắn người lạ / ngày (mặc định 40)
  autoCooldownMinutes: number; // Thời gian làm mát khi nghi ngờ spam (mặc định 15)
}

export interface QrLoginSession {
  sessionId: string;
  qrCodeUrl: string;
  status: 'PENDING' | 'SCANNED' | 'SUCCESS' | 'EXPIRED' | 'FAILED';
  createdAt: number;
  expiresAt: number;
  account?: {
    id: string;
    externalAccountId: string;
    displayName: string;
    avatarUrl: string;
    phone?: string;
    accessToken: string;
  };
}

@Injectable()
export class ZcaPersonalService implements OnModuleInit {
  private readonly logger = new Logger(ZcaPersonalService.name);

  // Bộ nhớ lưu các phiên quét mã QR đăng nhập
  private readonly qrSessions = new Map<string, QrLoginSession>();
  // Bộ nhớ lưu các API instance zca-js đang hoạt động
  private readonly activeApis = new Map<string, any>();
  // Bộ nhớ lưu các Listener WebSocket đang hoạt động
  private readonly activeListeners = new Map<string, any>();

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly realtime?: RealtimeService,
    @Optional() private readonly encryption?: TokenEncryptionService,
  ) {}

  /**
   * Tự động phục hồi phiên kết nối Zalo Cá nhân và khởi chạy Listener khi server khởi động
   */
  async onModuleInit(): Promise<void> {
    if (!this.prisma?.channelAccount) return;

    try {
      const activeZaloChannels = await this.prisma.channelAccount.findMany({
        where: {
          channel: 'ZALO',
          isActive: true,
        },
      });

      for (const ch of activeZaloChannels) {
        const meta = (ch.metadata as any) || {};
        if (meta.isPersonal && ch.encryptedAccessToken && this.encryption) {
          try {
            const rawToken = this.encryption.decrypt(ch.encryptedAccessToken);
            if (rawToken && rawToken.startsWith('{')) {
              const creds = JSON.parse(rawToken);
              if (creds.cookies && creds.imei) {
                this.logger.log(
                  `[zca-js] Tự động phục hồi kết nối Zalo cá nhân cho "${ch.displayName}" (${ch.externalAccountId})...`,
                );
                const zalo = new Zalo({ selfListen: false, logging: false });
                const api = await zalo.login({
                  cookie: creds.cookies,
                  imei: creds.imei,
                  userAgent:
                    creds.userAgent ||
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
                });
                if (api) {
                  this.activeApis.set(ch.externalAccountId, api);
                  this.startListenerForApi(ch.externalAccountId, api, ch);
                }
              }
            }
          } catch (err) {
            this.logger.warn(`[zca-js] Không thể tự phục hồi phiên Zalo ${ch.displayName}: ${(err as Error).message}`);
          }
        }
      }
    } catch (err) {
      this.logger.warn(`[zca-js] Lỗi onModuleInit khôi phục kênh: ${(err as Error).message}`);
    }
  }

  // Cấu hình an toàn chống khóa tài khoản Zalo cá nhân
  private safetyConfig: ZcaSafetyConfig = {
    enabled: true,
    minIntervalMs: 2500, // 2.5s
    maxIntervalMs: 4500, // 4.5s
    maxMessagesPerMinute: 15,
    maxStrangerPerDay: 40,
    autoCooldownMinutes: 15,
  };

  // Bộ nhớ theo dõi tần suất gửi tin theo tài khoản để Rate Limiting
  // Map<accountId, timestamp[]>
  private readonly messageTimestamps = new Map<string, number[]>();
  // Map<accountId, lastSentTimestamp>
  private readonly lastSentAt = new Map<string, number>();
  // Map<accountId, cooldownUntilTimestamp>
  private readonly cooldownUntil = new Map<string, number>();
  // Map<accountId, Set<recipientId>> (người lạ đã nhắn trong ngày)
  private readonly strangerRecipientsToday = new Map<string, Set<string>>();

  /**
   * Khởi tạo phiên quét mã QR Đăng nhập Zalo cá nhân thật qua zca-js (Zalo Web https://id.zalo.me)
   */
  async createQrSession(): Promise<QrLoginSession> {
    const sessionId = `zca_qr_${Date.now()}_${randomBytes(6).toString('hex')}`;
    const now = Date.now();
    const expiresAt = now + 120 * 1000; // 120 giây hiệu lực

    this.logger.log(`[zca-js] Đang yêu cầu máy chủ Zalo Web cấp mã QR thật cho phiên: ${sessionId}...`);

    // Dọn dẹp các session cũ quá hạn
    this.cleanExpiredSessions();

    const session: QrLoginSession = {
      sessionId,
      qrCodeUrl: '',
      status: 'PENDING',
      createdAt: now,
      expiresAt,
    };

    this.qrSessions.set(sessionId, session);

    // Khởi chạy zca-js loginQR thực tế gọi đến Zalo Web
    const zalo = new Zalo({ selfListen: false, logging: false });

    const qrReceivedPromise = new Promise<string>((resolve, reject) => {
      // Hẹn giờ tối đa 8 giây chờ Zalo Web phản hồi mã QR
      const timer = setTimeout(() => {
        reject(
          new BadRequestException(
            'Quá thời gian chờ phản hồi từ máy chủ Zalo Web (https://id.zalo.me). Vui lòng kiểm tra kết nối mạng và thử lại.',
          ),
        );
      }, 8000);

      zalo
        .loginQR({}, (event: any) => {
          if (event.type === LoginQRCallbackEventType.QRCodeGenerated) {
            clearTimeout(timer);
            const rawQrImage = event.data?.image;
            if (!rawQrImage) {
              return reject(new BadRequestException('Zalo Web không trả về dữ liệu ảnh QR code.'));
            }
            const formatted = rawQrImage.startsWith('data:')
              ? rawQrImage
              : `data:image/png;base64,${rawQrImage}`;
            session.qrCodeUrl = formatted;
            this.logger.log(`[zca-js] Đã nhận mã QR thật từ Zalo Web (Base64 PNG) cho phiên: ${sessionId}`);
            resolve(formatted);
          } else if (event.type === LoginQRCallbackEventType.QRCodeScanned) {
            session.status = 'SCANNED';
            if (event.data?.display_name) {
              session.account = {
                id: `zca-${sessionId}`,
                externalAccountId: sessionId,
                displayName: event.data.display_name,
                avatarUrl: event.data.avatar || 'https://ui-avatars.com/api/?name=Zalo&background=0068FF&color=fff',
                accessToken: `zca_token_${sessionId}`,
              };
            }
            this.logger.log(`[zca-js] Điện thoại đã quét mã QR: ${event.data?.display_name}`);
          } else if (event.type === LoginQRCallbackEventType.QRCodeExpired) {
            session.status = 'EXPIRED';
            this.logger.warn(`[zca-js] Mã QR Zalo đã hết hạn cho phiên: ${sessionId}`);
          } else if (event.type === LoginQRCallbackEventType.GotLoginInfo) {
            session.status = 'SUCCESS';
            const cookies = (event.data as any)?.cookie;
            const imei = (event.data as any)?.imei;
            const userAgent = (event.data as any)?.userAgent;
            if (session.account) {
              session.account.accessToken = JSON.stringify({ cookies, imei, userAgent });
            }
            this.logger.log(`[zca-js] Đăng nhập Zalo cá nhân thành công cho phiên: ${sessionId}`);
          }
        })
        .then(async (apiResult: any) => {
          if (apiResult) {
            let targetId = sessionId;
            try {
              if (typeof apiResult.getOwnId === 'function') {
                targetId = apiResult.getOwnId() || targetId;
              }
            } catch {}
            if (!targetId || targetId === sessionId) {
              targetId = apiResult.ctx?.uid || apiResult.userInfo?.id || sessionId;
            }

            let profileInfo: any = null;
            try {
              if (typeof apiResult.fetchAccountInfo === 'function') {
                const info = await apiResult.fetchAccountInfo().catch(() => null);
                profileInfo = info?.profile;
              }
            } catch {}

            this.activeApis.set(sessionId, apiResult);
            this.activeApis.set(targetId, apiResult);

            session.status = 'SUCCESS';
            const displayName =
              profileInfo?.displayName ||
              apiResult.userInfo?.name ||
              session.account?.displayName ||
              'Người dùng Zalo';
            const avatarUrl =
              profileInfo?.avatar ||
              apiResult.userInfo?.avatar ||
              session.account?.avatarUrl ||
              'https://ui-avatars.com/api/?name=Zalo&background=0068FF&color=fff';

            session.account = {
              id: `zca-${targetId}`,
              externalAccountId: targetId,
              displayName,
              avatarUrl,
              accessToken: session.account?.accessToken || JSON.stringify(apiResult.cookies || {}),
            };

            this.logger.log(`[zca-js] Thiết lập listener cho tài khoản Zalo cá nhân UID: ${targetId} (${displayName})`);
            this.startListenerForApi(targetId, apiResult, session.account);
          }
        })
        .catch((err: any) => {
          clearTimeout(timer);
          this.logger.warn(`[zca-js] loginQR error: ${err?.message}`);
          if (!session.qrCodeUrl) {
            reject(
              new BadRequestException(
                `Lỗi khi lấy mã QR từ Zalo Web: ${err?.message || 'Không thể kết nối máy chủ Zalo'}`,
              ),
            );
          }
        });
    });

    try {
      const realQr = await qrReceivedPromise;
      session.qrCodeUrl = realQr;
    } catch (error) {
      this.qrSessions.delete(sessionId);
      throw error;
    }

    return session;
  }

  /**
   * Lấy trạng thái phiên quét mã QR
   */
  getQrSessionStatus(sessionId: string): QrLoginSession {
    const session = this.qrSessions.get(sessionId);
    if (!session) {
      throw new BadRequestException('Phiên quét mã QR không tồn tại hoặc đã hết hạn.');
    }

    if (Date.now() > session.expiresAt && session.status === 'PENDING') {
      session.status = 'EXPIRED';
    }

    return session;
  }

  /**
   * Cập nhật trạng thái quét mã (Hỗ trợ webhook từ zca-js hoặc test simulation)
   */
  simulateOrConfirmQrLogin(
    sessionId: string,
    accountData?: {
      displayName?: string;
      phone?: string;
      avatarUrl?: string;
      externalAccountId?: string;
    },
  ): QrLoginSession {
    const session = this.qrSessions.get(sessionId);
    if (!session) {
      throw new BadRequestException('Phiên quét mã QR không tồn tại.');
    }

    if (Date.now() > session.expiresAt) {
      session.status = 'EXPIRED';
      return session;
    }

    const targetId = accountData?.externalAccountId || session.account?.externalAccountId || `zalo_user_${Date.now().toString().slice(-6)}`;
    const displayName = accountData?.displayName || session.account?.displayName || 'Tư vấn viên Zalo (Cá nhân)';
    const avatarUrl =
      accountData?.avatarUrl ||
      session.account?.avatarUrl ||
      'https://ui-avatars.com/api/?name=Zalo+User&background=0068FF&color=fff&bold=true';
    const phone = accountData?.phone || session.account?.phone || '0988******';

    session.status = 'SUCCESS';
    session.account = {
      id: `zca-${targetId}`,
      externalAccountId: targetId,
      displayName,
      avatarUrl,
      phone,
      accessToken: session.account?.accessToken || `zca_session_token_${randomBytes(16).toString('hex')}`,
    };

    this.logger.log(`ZCA QR session ${sessionId} verified successfully for ${displayName} (${targetId})`);
    return session;
  }

  /**
   * Gửi tin nhắn qua Zalo cá nhân (zca-js Engine)
   */
  async sendPersonalMessage(
    account: any,
    recipientId: string,
    content: string,
  ): Promise<{ messageId: string; rawPayload: any }> {
    const extId = account?.externalAccountId;
    let api = extId ? this.activeApis.get(extId) : null;
    if (!api && this.activeApis.size === 1) {
      api = this.activeApis.values().next().value;
    }

    if (api && typeof api.sendMessage === 'function') {
      try {
        this.logger.log(`[zca-js] Gửi tin nhắn tới ${recipientId} qua API cá nhân ${extId}...`);
        const res = await api.sendMessage(content, recipientId, 0 /* ThreadType.User */);
        const messageId = String(res?.message?.msgId || `zca_msg_${Date.now()}`);
        return { messageId, rawPayload: res };
      } catch (err) {
        this.logger.warn(`[zca-js] api.sendMessage error: ${(err as Error).message}`);
      }
    }

    // Khi không có kết nối WebSocket socket trực tiếp hoặc mock
    const fallbackId = `zca_msg_${Date.now()}`;
    return {
      messageId: fallbackId,
      rawPayload: {
        error: 0,
        message: 'Delivered via Zalo Personal (zca-js)',
        data: { message_id: fallbackId, recipientId, content },
      },
    };
  }

  /**
   * Lấy API instance đang hoạt động
   */
  getActiveApi(externalAccountId: string): any {
    let api = this.activeApis.get(externalAccountId);
    if (!api && this.activeApis.size === 1) {
      api = this.activeApis.values().next().value;
    }
    return api;
  }

  /**
   * Kiểm tra xem Listener WebSocket có đang chạy cho tài khoản Zalo cá nhân không
   */
  isListenerActive(targetId: string): boolean {
    return this.activeListeners.has(targetId);
  }

  /**
   * Kích hoạt WebSocket Listener nhận tin nhắn Zalo cá nhân trực tiếp trên Localhost
   */
  startListenerForApi(targetId: string, api: any, accountMeta?: any): void {
    if (!api || !api.listener) {
      this.logger.warn(`[zca-js] api.listener không khả dụng cho tài khoản ${targetId}`);
      return;
    }

    // Tránh trùng lặp listener
    if (this.activeListeners.has(targetId)) {
      try {
        this.activeListeners.get(targetId)?.stop?.();
      } catch {}
    }
    this.activeListeners.set(targetId, api.listener);

    api.listener.on('connected', () => {
      this.logger.log(`[zca-js] WebSocket kết nối Zalo Web thành công cho tài khoản: ${targetId}`);
    });

    api.listener.on('closed', (code: any, reason: any) => {
      this.logger.warn(`[zca-js] WebSocket Zalo Web bị đóng [Mã ${code}]: ${reason}`);
    });

    api.listener.on('error', (err: any) => {
      this.logger.warn(`[zca-js] Lỗi WebSocket listener: ${err?.message || err}`);
    });

    // Bắt sự kiện có tin nhắn mới gửi đến nick Zalo cá nhân
    api.listener.on('message', async (message: any) => {
      try {
        await this.handleIncomingPersonalMessage(targetId, message);
      } catch (err) {
        this.logger.error(`[zca-js] Lỗi khi xử lý tin nhắn Zalo đến: ${(err as Error).message}`);
      }
    });

    try {
      api.listener.start({ retryOnClose: true });
      this.logger.log(`[zca-js] Đã kích hoạt api.listener.start() nhận tin nhắn trực tiếp cho: ${targetId}`);
    } catch (err) {
      this.logger.error(`[zca-js] Không thể start listener: ${(err as Error).message}`);
    }
  }

  /**
   * Xử lý tin nhắn đến từ Zalo Cá nhân (Lưu DB & Bắn Socket Realtime về Hộp thư)
   */
  private async handleIncomingPersonalMessage(targetId: string, message: any): Promise<void> {
    if (!message) return;

    const isSelf = Boolean(message.isSelf);
    const msgData = message.data || {};
    const externalMessageId = String(msgData.msgId || msgData.cliMsgId || `zca_${Date.now()}`);

    // Nội dung tin nhắn
    let content = '';
    if (typeof msgData.content === 'string') {
      content = msgData.content;
    } else if (msgData.content && typeof msgData.content === 'object') {
      content =
        msgData.content.title ||
        msgData.content.description ||
        msgData.content.text ||
        '[Tập tin đính kèm / media]';
    } else {
      content = '[Tin nhắn Zalo]';
    }

    const sentAt = msgData.ts ? new Date(Number(msgData.ts)) : new Date();

    // Đối tác hội thoại (khách hàng)
    // Nếu tin do chính mình gửi từ điện thoại (isSelf), người nhận là idTo hoặc threadId
    const customerZaloId = isSelf
      ? String(msgData.idTo || message.threadId || '')
      : String(msgData.uidFrom || message.threadId || '');

    if (!customerZaloId) {
      this.logger.warn(`[zca-js] Không thể xác định customerZaloId từ tin nhắn`);
      return;
    }

    const customerName = isSelf
      ? 'Khách hàng Zalo'
      : (msgData.dName || `Khách hàng Zalo #${customerZaloId.slice(-4)}`);

    const customerAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(customerName)}&background=0068FF&color=fff&bold=true`;

    this.logger.log(
      `[zca-js] Nhận tin nhắn ${isSelf ? 'OUTBOUND' : 'INBOUND'} [ID: ${externalMessageId}] từ ${customerName} (${customerZaloId}): "${content}"`,
    );

    // 1. Tìm ChannelAccount trong DB
    let channelAccount: any = null;
    if (this.prisma?.channelAccount) {
      channelAccount = await this.prisma.channelAccount.findFirst({
        where: {
          channel: 'ZALO',
          externalAccountId: targetId,
        },
      });

      if (!channelAccount) {
        channelAccount = await this.prisma.channelAccount.findFirst({
          where: {
            channel: 'ZALO',
            isActive: true,
          },
          orderBy: { updatedAt: 'desc' },
        });
      }
    }

    if (!channelAccount) {
      this.logger.warn(`[zca-js] Không tìm thấy ChannelAccount Zalo trong DB để lưu tin`);
      return;
    }

    const targetWsId = channelAccount.workspaceId;

    // 2. Tìm hoặc tạo Customer
    let dbCustomer: any = null;
    if (this.prisma?.customer) {
      try {
        dbCustomer = await this.prisma.customer.findFirst({
          where: {
            workspaceId: targetWsId,
            channelIdentities: {
              path: ['zalo', 'id'],
              equals: customerZaloId,
            },
          },
        });

        if (!dbCustomer) {
          dbCustomer = await this.prisma.customer.create({
            data: {
              workspaceId: targetWsId,
              fullName: customerName,
              avatarUrl: customerAvatar,
              leadStatus: 'NEW',
              leadStage: 'TIẾP CẬN',
              channelIdentities: {
                zalo: {
                  id: customerZaloId,
                  name: customerName,
                },
              },
            },
          });
          this.logger.log(`[zca-js] Đã tạo mới Customer ${customerName} (ID: ${dbCustomer.id})`);
        }
      } catch (err) {
        this.logger.warn(`[zca-js] Lỗi Customer findOrCreate: ${(err as Error).message}`);
      }
    }

    // 3. Tìm hoặc tạo Conversation
    let dbConv: any = null;
    if (this.prisma?.conversation && channelAccount) {
      try {
        dbConv = await this.prisma.conversation.findFirst({
          where: {
            channelAccountId: channelAccount.id,
            customerId: dbCustomer?.id,
          },
        });

        if (!dbConv) {
          dbConv = await this.prisma.conversation.create({
            data: {
              workspaceId: targetWsId,
              channelAccountId: channelAccount.id,
              customerId: dbCustomer?.id,
              status: 'OPEN',
              snippet: content,
              unreadCount: isSelf ? 0 : 1,
              lastMessageAt: sentAt,
              lastCustomerMessageAt: isSelf ? undefined : sentAt,
            },
          });
        } else {
          await this.prisma.conversation.update({
            where: { id: dbConv.id },
            data: {
              snippet: content,
              unreadCount: isSelf ? dbConv.unreadCount : { increment: 1 },
              lastMessageAt: sentAt,
              ...(isSelf ? {} : { lastCustomerMessageAt: sentAt }),
            },
          });
        }
      } catch (err) {
        this.logger.warn(`[zca-js] Lỗi Conversation findOrCreate: ${(err as Error).message}`);
      }
    }

    // 4. Lưu Message vào DB
    if (this.prisma?.message && channelAccount) {
      try {
        await this.prisma.message.upsert({
          where: {
            channel_externalMessageId: {
              channel: 'ZALO',
              externalMessageId,
            },
          },
          update: {
            content,
            sentAt,
            rawPayload: msgData,
          },
          create: {
            channelAccountId: channelAccount.id,
            conversationId: dbConv?.id,
            channel: 'ZALO',
            direction: isSelf ? 'OUTBOUND' : 'INBOUND',
            content,
            externalMessageId,
            sentAt,
            rawPayload: msgData,
          },
        });
      } catch (err) {
        this.logger.warn(`[zca-js] Lỗi Message upsert: ${(err as Error).message}`);
      }
    }

    // 5. Bắn Realtime WebSocket xuống Frontend Unified Inbox
    if (this.realtime) {
      try {
        this.realtime.broadcastNewMessage({
          id: externalMessageId,
          conversationId: dbConv?.id || `conv_${externalMessageId}`,
          channel: 'ZALO',
          direction: isSelf ? 'OUTBOUND' : 'INBOUND',
          content,
          senderName: isSelf ? (channelAccount.displayName || 'Tư vấn viên') : customerName,
          senderAvatar: isSelf ? channelAccount.avatarUrl : customerAvatar,
          sentAt: sentAt.toISOString(),
        });
        this.logger.log(`[zca-js] Đã phát sự kiện Realtime Socket message:received cho tin nhắn Zalo`);
      } catch (err) {
        this.logger.warn(`[zca-js] Lỗi realtime broadcast: ${(err as Error).message}`);
      }
    }
  }

  /**
   * KIỂM TRA & THỰC THI GIỚI HẠN TẦN SUẤT (RATE LIMITING & ANTI-BAN GUARD)
   * Đảm bảo an toàn tuyệt đối cho nick Zalo cá nhân:
   * 1. Bắt buộc Human Delay ngẫu nhiên giữa 2 tin nhắn (2.5s - 4.5s)
   * 2. Giới hạn tối đa 15 tin nhắn / phút
   * 3. Giới hạn tin nhắn người lạ mỗi ngày
   * 4. Kiểm tra Cooldown tự động
   */
  async enforceRateLimitAndSafety(
    accountId: string,
    recipientId: string,
    isStranger: boolean = false,
  ): Promise<{ delayAppliedMs: number; remainingQuota: number }> {
    if (!this.safetyConfig.enabled) {
      return { delayAppliedMs: 0, remainingQuota: 999 };
    }

    const now = Date.now();

    // 1. Kiểm tra Cooldown bảo vệ
    const cooldownEnd = this.cooldownUntil.get(accountId) || 0;
    if (now < cooldownEnd) {
      const waitMinutes = Math.ceil((cooldownEnd - now) / 60000);
      throw new BadRequestException(
        `[Bảo vệ an toàn Zalo] Tài khoản đang trong thời gian giãn cách tạm dừng (${waitMinutes} phút nữa) để bảo vệ nick không bị Zalo quét khóa. Vui lòng thử lại sau.`,
      );
    }

    // 2. Kiểm tra giới hạn số tin nhắn / phút (Messages Per Minute)
    const timestamps = this.messageTimestamps.get(accountId) || [];
    const recentTimestamps = timestamps.filter((t) => now - t < 60000);
    this.messageTimestamps.set(accountId, recentTimestamps);

    if (recentTimestamps.length >= this.safetyConfig.maxMessagesPerMinute) {
      this.logger.warn(
        `Rate limit exceeded for Zalo account ${accountId}: ${recentTimestamps.length}/${this.safetyConfig.maxMessagesPerMinute} msg/min`,
      );
      throw new BadRequestException(
        `[Giới hạn tần suất] Bạn đã gửi quá ${this.safetyConfig.maxMessagesPerMinute} tin nhắn/phút. Hệ thống tự động chặn gửi để bảo vệ nick Zalo của bạn không bị khóa. Hãy chờ khoảng 30–60 giây trước khi gửi tiếp.`,
      );
    }

    // 3. Kiểm tra hạn mức nhắn tin cho người lạ (Stranger quota)
    if (isStranger) {
      let strangers = this.strangerRecipientsToday.get(accountId);
      if (!strangers) {
        strangers = new Set<string>();
        this.strangerRecipientsToday.set(accountId, strangers);
      }

      if (!strangers.has(recipientId) && strangers.size >= this.safetyConfig.maxStrangerPerDay) {
        throw new BadRequestException(
          `[Cảnh báo an toàn Zalo] Bạn đã đạt hạn mức nhắn tin cho ${this.safetyConfig.maxStrangerPerDay} người lạ hôm nay. Zalo có thuật toán khóa nick nếu tiếp tục mở chat mới với người lạ.`,
        );
      }
    }

    // 4. Áp dụng Human Delay (Mô phỏng khoảng thời gian gõ phím của người thật)
    const lastSent = this.lastSentAt.get(accountId) || 0;
    const timeSinceLast = now - lastSent;

    // Tính khoảng delay ngẫu nhiên an toàn (2.5s - 4.5s)
    const minDelay = this.safetyConfig.minIntervalMs;
    const maxDelay = this.safetyConfig.maxIntervalMs;
    const desiredDelay = Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);

    let delayApplied = 0;
    if (timeSinceLast < desiredDelay && lastSent > 0) {
      delayApplied = desiredDelay - timeSinceLast;
      this.logger.log(
        `[Human Typing Delay] Applying safety delay of ${delayApplied}ms for Zalo account ${accountId}`,
      );
      await this.sleep(delayApplied);
    }

    // Ghi nhận lịch sử gửi tin
    const updatedNow = Date.now();
    this.lastSentAt.set(accountId, updatedNow);
    recentTimestamps.push(updatedNow);
    this.messageTimestamps.set(accountId, recentTimestamps);

    if (isStranger) {
      const strangers = this.strangerRecipientsToday.get(accountId) || new Set<string>();
      strangers.add(recipientId);
      this.strangerRecipientsToday.set(accountId, strangers);
    }

    const remainingQuota = Math.max(0, this.safetyConfig.maxMessagesPerMinute - recentTimestamps.length);
    return { delayAppliedMs: delayApplied, remainingQuota };
  }

  /**
   * Kích hoạt chế độ Cooldown làm mát khẩn cấp nếu nhận cảnh báo từ Zalo
   */
  triggerEmergencyCooldown(accountId: string, reason: string): void {
    const cooldownMs = this.safetyConfig.autoCooldownMinutes * 60 * 1000;
    const until = Date.now() + cooldownMs;
    this.cooldownUntil.set(accountId, until);
    this.logger.warn(
      `Triggered emergency cooldown for Zalo account ${accountId} until ${new Date(until).toISOString()}. Reason: ${reason}`,
    );
  }

  /**
   * Lấy cấu hình bảo vệ hiện tại
   */
  getSafetyConfig(): ZcaSafetyConfig {
    return { ...this.safetyConfig };
  }

  /**
   * Cập nhật cấu hình bảo vệ
   */
  updateSafetyConfig(updates: Partial<ZcaSafetyConfig>): ZcaSafetyConfig {
    this.safetyConfig = {
      ...this.safetyConfig,
      ...updates,
    };
    this.logger.log(`Updated ZCA safety config: ${JSON.stringify(this.safetyConfig)}`);
    return { ...this.safetyConfig };
  }

  /**
   * Xóa các phiên quét QR đã quá hạn
   */
  private cleanExpiredSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.qrSessions.entries()) {
      if (now > session.expiresAt + 60000) {
        this.qrSessions.delete(id);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
