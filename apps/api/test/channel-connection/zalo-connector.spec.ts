import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { OAuthService } from '../../src/modules/channel-connection/application/oauth.service.js';
import { ChannelManagerService } from '../../src/modules/channel-connection/application/channel-manager.service.js';
import { ChannelConnectorController } from '../../src/modules/channel-connection/presentation/channel-connector.controller.js';
import { TokenEncryptionService } from '../../src/modules/channel-connection/infrastructure/token-encryption.service.js';
import { ZcaPersonalService } from '../../src/modules/channel-connection/application/zca-personal.service.js';
import { ZaloAdapter } from '../../src/modules/messaging/infrastructure/adapters/zalo.adapter.js';
import { Channel, MessageDirection } from '../../src/modules/messaging/domain/channel.js';
// @ts-ignore
import { Zalo, LoginQRCallbackEventType } from 'zca-js';

describe('Zalo Channel Connection & Messaging', () => {
  let oauthService: OAuthService;
  let channelManager: ChannelManagerService;
  let controller: ChannelConnectorController;
  let zcaService: ZcaPersonalService;
  let encryption: TokenEncryptionService;
  let zaloAdapter: ZaloAdapter;
  let mockPrisma: any;
  let mockMessageRepo: any;
  let mockRealtime: any;

  beforeEach(() => {
    const config = new ConfigService({
      NODE_ENV: 'development',
      TOKEN_ENCRYPTION_KEY: 'test_token_encryption_key_32_characters_long_12345',
      ZALO_APP_ID: '1234567890',
      ZALO_APP_SECRET: 'zalo_secret_test',
      FRONTEND_URL: 'http://localhost:5173',
    });

    encryption = new TokenEncryptionService(config);
    oauthService = new OAuthService(config);
    zaloAdapter = new ZaloAdapter();

    mockMessageRepo = {
      insertManyIgnoreDuplicate: vi.fn().mockResolvedValue([{ id: 'msg-uuid-1' }]),
    };

    mockRealtime = {
      broadcastNewMessage: vi.fn(),
      broadcastPipelineChange: vi.fn(),
    };

    mockPrisma = {
      workspace: {
        findFirst: vi.fn().mockResolvedValue({ id: 'ws-uuid-001', name: 'CUSC Workspace' }),
        findUnique: vi.fn().mockResolvedValue({ id: 'ws-uuid-001', name: 'CUSC Workspace' }),
      },
      customer: {
        findFirst: vi.fn().mockResolvedValue({ id: 'cust-uuid-1', fullName: 'Khách hàng Zalo' }),
        create: vi.fn().mockResolvedValue({ id: 'cust-uuid-1', fullName: 'Khách hàng Zalo' }),
      },
      channelAccount: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'zalo-acc-1',
          workspaceId: 'ws-uuid-001',
          channel: Channel.ZALO,
          externalAccountId: '3141592653589793',
          displayName: 'Zalo OA Tuyển Sinh CUSC',
          encryptedAccessToken: encryption.encrypt('real_zalo_access_token_xyz'),
          isActive: true,
        }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'zalo-acc-1',
          workspaceId: 'ws-uuid-001',
          channel: Channel.ZALO,
          externalAccountId: '3141592653589793',
          displayName: 'Zalo OA Tuyển Sinh CUSC',
          encryptedAccessToken: encryption.encrypt('real_zalo_access_token_xyz'),
          isActive: true,
        }),
        upsert: vi.fn().mockImplementation(({ create }) =>
          Promise.resolve({
            id: 'zalo-acc-1',
            ...create,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({
            id: where.id,
            ...data,
            updatedAt: new Date(),
          }),
        ),
      },
      conversation: {
        findFirst: vi.fn().mockResolvedValue({ id: 'conv-uuid-1' }),
        create: vi.fn().mockResolvedValue({ id: 'conv-uuid-1' }),
        update: vi.fn().mockResolvedValue({ id: 'conv-uuid-1' }),
      },
    };

    zcaService = new ZcaPersonalService();
    channelManager = new ChannelManagerService(mockPrisma, encryption, mockMessageRepo, mockRealtime, zcaService);
    controller = new ChannelConnectorController(oauthService, channelManager, zcaService);

    vi.spyOn(Zalo.prototype, 'loginQR').mockImplementation(((options: any, callback: any) => {
      if (callback) {
        callback({
          type: LoginQRCallbackEventType.QRCodeGenerated,
          data: {
            image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            code: 'real_zalo_code_mock',
          },
        });
      }
      return new Promise(() => {});
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Kiểm tra kết nối Zalo OA & Lấy Tên, Ảnh đại diện', () => {
    it('Xác thực với Mock Token: trả về thông tin OA đầy đủ (Tên, Avatar, OA ID)', async () => {
      const res = await oauthService.exchangeToken('ZALO', undefined, undefined, undefined, {
        accessToken: 'mock_zalo_token_123',
        pageId: '3141592653589793',
      });

      expect(res.channel).toBe('ZALO');
      expect(res.pages).toHaveLength(1);
      const page = res.pages[0];
      expect(page.externalAccountId).toBe('3141592653589793');
      expect(page.name).toContain('Tuyển Sinh');
      expect(page.avatarUrl).toBeTruthy();
      expect(page.isVerified).toBe(true);
      expect(res.testResult?.success).toBe(true);
    });

    it('Xác thực thực tế qua Zalo OpenAPI (getoa): lấy chính xác tên và ảnh đại diện OA', async () => {
      const mockZaloResponse = {
        data: {
          oa_id: '3141592653589793',
          name: 'Trung tâm Đào tạo Công nghệ CUSC',
          description: 'CUSC - Trường Đại học Cần Thơ',
          avatar: 'https://s120.avatar.talk.zdn.vn/oa_avatar_cusc.png',
          cover: 'https://cover.talk.zdn.vn/cusc.png',
          is_verified: true,
          num_follower: 4500,
        },
        error: 0,
        message: 'Success',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockZaloResponse),
      });

      const res = await oauthService.exchangeToken('ZALO', undefined, undefined, undefined, {
        accessToken: 'valid_live_zalo_access_token',
      });

      expect(globalThis.fetch).toHaveBeenCalledWith('https://openapi.zalo.me/v2.0/oa/getoa', {
        method: 'GET',
        headers: { access_token: 'valid_live_zalo_access_token' },
      });

      expect(res.pages).toHaveLength(1);
      const page = res.pages[0];
      expect(page.name).toBe('Trung tâm Đào tạo Công nghệ CUSC');
      expect(page.avatarUrl).toBe('https://s120.avatar.talk.zdn.vn/oa_avatar_cusc.png');
      expect(page.externalAccountId).toBe('3141592653589793');
      expect(page.followerCount).toBe(4500);
      expect(page.isVerified).toBe(true);
      expect(res.testResult?.details.pageName).toBe('Trung tâm Đào tạo Công nghệ CUSC');
    });

    it('Báo lỗi chi tiết khi Access Token Zalo hết hạn (-216)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ error: -216, message: 'Access token is invalid' }),
      });

      await expect(
        oauthService.exchangeToken('ZALO', undefined, undefined, undefined, {
          accessToken: 'expired_zalo_token',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Bắt buộc phải có Access Token khi kết nối Zalo OA', async () => {
      await expect(
        oauthService.exchangeToken('ZALO', undefined, undefined, undefined, {
          accessToken: '',
        }),
      ).rejects.toThrow('bắt buộc phải có Access Token');
    });
  });

  describe('2. Nhận tin nhắn từ Zalo (Webhook Inbound)', () => {
    it('Phân tích cú pháp webhook user_send_text thành công', () => {
      const webhookPayload = {
        app_id: '1234567890',
        oa_id: '3141592653589793',
        event_name: 'user_send_text',
        sender: { id: 'zalo_user_9988' },
        recipient: { id: '3141592653589793' },
        message: {
          text: 'Xin chào trung tâm, mình muốn tư vấn khóa học Lập trình Web',
          msg_id: 'zalo_msg_10101',
        },
        info: {
          name: 'Nguyễn Văn An',
          avatar: 'https://s120.avatar.talk.zdn.vn/user_an.png',
        },
        timestamp: '1672531199000',
      };

      const events = zaloAdapter.parseEvents({
        headers: {},
        rawBody: Buffer.from(JSON.stringify(webhookPayload)),
      });

      expect(events).toHaveLength(1);
      const ev = events[0];
      expect(ev.channel).toBe(Channel.ZALO);
      expect(ev.externalAccountId).toBe('3141592653589793');
      expect(ev.senderExternalId).toBe('zalo_user_9988');
      expect(ev.direction).toBe(MessageDirection.INBOUND);
      expect(ev.content).toBe('Xin chào trung tâm, mình muốn tư vấn khóa học Lập trình Web');
      expect(ev.externalMessageId).toBe('zalo_msg_10101');
      expect((ev.rawPayload as any).customerName).toBe('Nguyễn Văn An');
      expect((ev.rawPayload as any).customerAvatar).toBe('https://s120.avatar.talk.zdn.vn/user_an.png');
    });

    it('Phân tích cú pháp webhook user_send_image kèm đính kèm', () => {
      const webhookPayload = {
        app_id: '1234567890',
        oa_id: '3141592653589793',
        event_name: 'user_send_image',
        sender: { id: 'zalo_user_9988' },
        recipient: { id: '3141592653589793' },
        message: {
          text: 'Hình bằng tốt nghiệp',
          attachments: [
            {
              type: 'image',
              payload: { url: 'https://s120.avatar.talk.zdn.vn/bang_tot_nghiep.jpg' },
            },
          ],
          msg_id: 'zalo_img_20202',
        },
      };

      const events = zaloAdapter.parseEvents({
        headers: {},
        rawBody: Buffer.from(JSON.stringify(webhookPayload)),
      });

      expect(events).toHaveLength(1);
      expect(events[0].content).toBe('Hình bằng tốt nghiệp');
      expect((events[0].rawPayload as any).attachments).toHaveLength(1);
      expect((events[0].rawPayload as any).attachments[0].url).toBe(
        'https://s120.avatar.talk.zdn.vn/bang_tot_nghiep.jpg',
      );
    });

    it('Phân tích cú pháp tin nhắn Outbound oa_send_text', () => {
      const webhookPayload = {
        app_id: '1234567890',
        event_name: 'oa_send_text',
        sender: { id: '3141592653589793' },
        recipient: { id: 'zalo_user_9988' },
        message: {
          text: 'Chào bạn, trung tâm sẵn sàng tư vấn!',
          msg_id: 'zalo_out_30303',
        },
      };

      const events = zaloAdapter.parseEvents({
        headers: {},
        rawBody: Buffer.from(JSON.stringify(webhookPayload)),
      });

      expect(events).toHaveLength(1);
      expect(events[0].direction).toBe(MessageDirection.OUTBOUND);
      expect(events[0].externalAccountId).toBe('3141592653589793');
    });
  });

  describe('3. Gửi tin nhắn qua Zalo OA (Outbound Message)', () => {
    it('Gửi tin nhắn qua Zalo Open API (/v3.0/oa/message/cs)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { message_id: 'sent_zalo_msg_8888' },
            error: 0,
            message: 'Success',
          }),
      });

      const res = await channelManager.sendMessage({
        channel: 'ZALO',
        recipientId: 'zalo_customer_12345',
        content: 'CUSC xin gửi bạn thông tin học phí khóa học!',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe('sent_zalo_msg_8888');
      expect(res.content).toBe('CUSC xin gửi bạn thông tin học phí khóa học!');

      expect(globalThis.fetch).toHaveBeenCalledWith('https://openapi.zalo.me/v3.0/oa/message/cs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: 'real_zalo_access_token_xyz',
        },
        body: JSON.stringify({
          recipient: { user_id: 'zalo_customer_12345' },
          message: { text: 'CUSC xin gửi bạn thông tin học phí khóa học!' },
        }),
      });

      // Kiểm tra lưu vào MessageRepository với hướng OUTBOUND
      expect(mockMessageRepo.insertManyIgnoreDuplicate).toHaveBeenCalledWith([
        expect.objectContaining({
          channel: Channel.ZALO,
          direction: MessageDirection.OUTBOUND,
          externalMessageId: 'sent_zalo_msg_8888',
        }),
      ]);

      // Kiểm tra phát tin nhắn qua Realtime WebSocket
      expect(mockRealtime.broadcastNewMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'OUTBOUND',
          content: 'CUSC xin gửi bạn thông tin học phí khóa học!',
        }),
      );
    });

    it('Xử lý chính sách Zalo 7 ngày tương tác (-201)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            error: -201,
            message: 'Customer has not interacted with OA in the last 7 days',
          }),
      });

      await expect(
        channelManager.sendMessage({
          channel: 'ZALO',
          recipientId: 'inactive_customer',
          content: 'Xin chào',
        }),
      ).rejects.toThrow('Chính sách Zalo: Khách hàng chưa gửi tin nhắn cho OA trong 7 ngày qua');
    });

    it('Endpoint POST /channels/send-message kiểm tra hợp lệ dữ liệu đầu vào', async () => {
      await expect(
        controller.sendMessage({
          channel: 'ZALO',
          recipientId: '',
          content: 'Xin chào',
        }),
      ).rejects.toThrow('recipientId');

      await expect(
        controller.sendMessage({
          channel: 'ZALO',
          recipientId: 'user_123',
          content: '',
        }),
      ).rejects.toThrow('Nội dung tin nhắn');
    });
  });

  describe('4. Zalo Cá nhân (zca-js) QR Login & Giới hạn tần suất Anti-Ban', () => {
    it('Khởi tạo phiên QR code thật từ Zalo Web (Base64 PNG)', async () => {
      const session = await zcaService.createQrSession();
      expect(session.sessionId).toMatch(/^zca_qr_/);
      expect(session.status).toBe('PENDING');
      expect(session.qrCodeUrl).toContain('data:image/png;base64,');
      expect(session.expiresAt).toBeGreaterThan(Date.now());
    });

    it('Lấy trạng thái phiên QR: ném lỗi nếu sessionId không hợp lệ', () => {
      expect(() => zcaService.getQrSessionStatus('invalid_session_id')).toThrow(BadRequestException);
    });

    it('Xác nhận đăng nhập thành công sau khi quét mã QR', async () => {
      const session = await zcaService.createQrSession();
      const verified = zcaService.simulateOrConfirmQrLogin(session.sessionId, {
        displayName: 'Nguyễn Văn A (CUSC Counselor)',
        phone: '0912345678',
      });

      expect(verified.status).toBe('SUCCESS');
      expect(verified.account?.displayName).toBe('Nguyễn Văn A (CUSC Counselor)');
      expect(verified.account?.phone).toBe('0912345678');
      expect(verified.account?.accessToken).toContain('zca_session_token_');
    });

    it('Giới hạn tần suất: chặn khi vượt quá 15 tin nhắn / phút để bảo vệ tài khoản', async () => {
      const accountId = 'zca_account_test_ratelimit';
      zcaService.updateSafetyConfig({ minIntervalMs: 0, maxIntervalMs: 0 }); // tắt typing delay để test số lượng

      for (let i = 0; i < 15; i++) {
        await zcaService.enforceRateLimitAndSafety(accountId, `user_${i}`);
      }

      // Tin nhắn thứ 16 phải bị ném BadRequestException
      await expect(
        zcaService.enforceRateLimitAndSafety(accountId, 'user_exceed'),
      ).rejects.toThrow('Bạn đã gửi quá 15 tin nhắn/phút');
    });

    it('Giới hạn tin nhắn cho người lạ: chặn khi vượt quá quota người lạ / ngày', async () => {
      const accountId = 'zca_account_test_stranger';
      zcaService.updateSafetyConfig({ minIntervalMs: 0, maxIntervalMs: 0, maxStrangerPerDay: 3 });

      await zcaService.enforceRateLimitAndSafety(accountId, 'stranger_1', true);
      await zcaService.enforceRateLimitAndSafety(accountId, 'stranger_2', true);
      await zcaService.enforceRateLimitAndSafety(accountId, 'stranger_3', true);

      // Nhắn lại người cũ: được phép
      await zcaService.enforceRateLimitAndSafety(accountId, 'stranger_1', true);

      // Nhắn người lạ thứ 4: bị chặn
      await expect(
        zcaService.enforceRateLimitAndSafety(accountId, 'stranger_4', true),
      ).rejects.toThrow('Bạn đã đạt hạn mức nhắn tin cho 3 người lạ hôm nay');
    });

    it('Kích hoạt thời gian nghỉ Cooldown khi phát hiện nghi vấn cảnh báo', async () => {
      const accountId = 'zca_account_cooldown';
      zcaService.triggerEmergencyCooldown(accountId, 'Cảnh báo spam từ hệ thống Zalo');

      await expect(
        zcaService.enforceRateLimitAndSafety(accountId, 'any_user'),
      ).rejects.toThrow('Tài khoản đang trong thời gian giãn cách tạm dừng');
    });
  });

  describe('5. Đồng bộ tin nhắn gần nhất từ Zalo (syncChannel & syncZaloMessages)', () => {
    it('Đồng bộ tin nhắn Zalo OA thành công, lưu hội thoại và phát Realtime WebSocket', async () => {
      vi.spyOn(global, 'fetch').mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              error: 0,
              message: 'Success',
              data: [
                {
                  user_id: '3141592653589793_cust1',
                  display_name: 'Nguyễn Văn A',
                  avatar: 'https://ui-avatars.com/api/?name=Nguyen+Van+A',
                  last_message: {
                    message_id: 'zalo_oa_msg_real_001',
                    text: 'Xin chào trung tâm CUSC, em muốn tư vấn khóa học',
                    time: Date.now() - 60000,
                  },
                },
              ],
            }),
        } as any),
      );

      const result = await channelManager.syncChannel('zalo-acc-1', 'ws-uuid-001');

      expect(result.syncedCount).toBeGreaterThanOrEqual(1);
      expect(result.conversationsCount).toBeGreaterThanOrEqual(1);
      expect(result.pageName).toContain('Zalo OA Tuyển Sinh CUSC');

      // Đảm bảo tin nhắn được ghi nhận vào MessageRepository
      expect(mockMessageRepo.insertManyIgnoreDuplicate).toHaveBeenCalled();

      // Đảm bảo phát WebSocket Realtime đến màn hình Hộp thư
      expect(mockRealtime.broadcastNewMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'ZALO',
          direction: 'INBOUND',
        }),
      );
    });

    it('Tuyệt đối không sinh dữ liệu mock khi không có tin nhắn Zalo mới', async () => {
      vi.spyOn(global, 'fetch').mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ error: 0, data: [] }),
        } as any),
      );

      const result = await channelManager.syncChannel('zalo-acc-1', 'ws-uuid-001');
      expect(result.syncedCount).toBe(0);
      expect(result.conversationsCount).toBe(0);
      expect(result.pageName).toContain('Zalo OA Tuyển Sinh CUSC');
    });

    it('Đồng bộ tin nhắn Zalo Cá nhân (zca-js): không sinh dữ liệu giả, duy trì lắng nghe realtime', async () => {
      mockPrisma.channelAccount.findUnique.mockResolvedValueOnce({
        id: 'zca-acc-personal',
        workspaceId: 'ws-uuid-001',
        channel: Channel.ZALO,
        externalAccountId: 'zca_user_123456',
        displayName: 'Tư vấn viên Zalo Cá nhân',
        encryptedAccessToken: encryption.encrypt('zca_token_test'),
        isActive: true,
        metadata: { isPersonal: true, engine: 'zca-js' },
      });

      const result = await channelManager.syncChannel('zca-acc-personal', 'ws-uuid-001');

      expect(result.syncedCount).toBe(0);
      expect(result.conversationsCount).toBe(0);
      expect(result.pageName).toBe('Tư vấn viên Zalo Cá nhân');
    });

    it('Gửi tin nhắn Outbound qua Zalo Cá nhân (zca-js) thành công', async () => {
      mockPrisma.channelAccount.findUnique.mockResolvedValueOnce({
        id: 'zca-acc-personal',
        workspaceId: 'ws-uuid-001',
        channel: Channel.ZALO,
        externalAccountId: 'zca_user_123456',
        displayName: 'Tư vấn viên Zalo Cá nhân',
        encryptedAccessToken: encryption.encrypt('zca_token_test'),
        isActive: true,
        metadata: { isPersonal: true, engine: 'zca-js' },
      });

      zcaService.updateSafetyConfig({ minIntervalMs: 0, maxIntervalMs: 0 });

      const res = await channelManager.sendMessage({
        channel: 'ZALO',
        channelAccountId: 'zca-acc-personal',
        recipientId: 'user_recipient_999',
        content: 'Xin chào bạn, mình gửi lộ trình học nhé!',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toContain('zca_msg_');
      expect(res.channel).toBe('ZALO');
      expect(mockRealtime.broadcastNewMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'OUTBOUND',
          content: 'Xin chào bạn, mình gửi lộ trình học nhé!',
        }),
      );
    });

    it('Tự động cập nhật kênh Zalo cũ và dọn dẹp bản ghi trùng lặp khi kết nối lại', async () => {
      mockPrisma.channelAccount.findMany.mockResolvedValueOnce([
        {
          id: 'zalo-old-primary',
          workspaceId: 'ws-uuid-001',
          channel: Channel.ZALO,
          externalAccountId: 'old_uid_111',
          displayName: 'Zalo Tuyển Sinh',
          isActive: true,
        },
        {
          id: 'zalo-duplicate-redundant',
          workspaceId: 'ws-uuid-001',
          channel: Channel.ZALO,
          externalAccountId: 'old_uid_duplicate',
          displayName: 'Zalo Tuyển Sinh',
          isActive: false,
        },
      ]);

      const activateRes = await channelManager.activateChannels(
        {
          pages: [
            {
              id: 'page_new',
              externalAccountId: 'new_uid_222',
              displayName: 'Zalo Tuyển Sinh (Đã quét lại)',
              channel: 'ZALO',
              accessToken: 'mock_reconnected_token',
            },
          ],
        },
        'ws-uuid-001',
      );

      // Đã dọn dẹp kênh thừa
      expect(mockPrisma.channelAccount.deleteMany).toHaveBeenCalled();
      // Đã cập nhật kênh hiện tại
      expect(mockPrisma.channelAccount.update).toHaveBeenCalled();
      // Chỉ trả về đúng 1 kênh Zalo đã kích hoạt
      expect(activateRes.activatedCount).toBe(1);
      expect(activateRes.channels[0].displayName).toBe('Zalo Tuyển Sinh (Đã quét lại)');
    });
  });
});
