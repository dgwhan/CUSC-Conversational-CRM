import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { NotificationService } from '../../notification/notification.service.js';
import { RealtimeService } from '../../realtime/realtime.service.js';
import { NotificationType, NotificationSeverity } from '@prisma/client';

@Injectable()
export class ZaloTokenMonitorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ZaloTokenMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Chạy kiểm tra ngay khi ứng dụng khởi động xong
   */
  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Khởi chạy giám sát thời hạn Zalo cá nhân (ZaloTokenMonitorService)...');
    try {
      await this.scanZaloAccounts();
    } catch (err) {
      this.logger.error(`Lỗi khi quét thời hạn Zalo ban đầu: ${(err as Error).message}`);
    }
  }

  /**
   * Định kỳ quét mỗi 15 phút
   */
  @Cron('0 */15 * * * *')
  async handleCron(): Promise<void> {
    this.logger.log('[ZaloTokenMonitor] Bắt đầu chu kỳ quét định kỳ 15 phút...');
    await this.scanZaloAccounts();
  }

  /**
   * Quét tất cả tài khoản Zalo cá nhân đang hoạt động để đánh giá thời hạn
   */
  async scanZaloAccounts(): Promise<void> {
    try {
      const activeZaloAccounts = await this.prisma.channelAccount.findMany({
        where: {
          channel: 'ZALO',
          isActive: true,
        },
      });

      const now = new Date();

      for (const account of activeZaloAccounts) {
        if (!account.workspaceId) continue;

        // Chỉ áp dụng cho Zalo cá nhân (engine zca-js)
        const meta = (account.metadata as Record<string, any>) || {};
        const isPersonal = meta.isPersonal === true || meta.engine === 'zca-js' || (!meta.oaId && !meta.appId);
        if (!isPersonal) continue;

        let tokenExpiresAt = account.tokenExpiresAt;

        // Nếu chưa có tokenExpiresAt, gán mặc định thời điểm đăng nhập/tạo + 72 giờ
        if (!tokenExpiresAt) {
          const baseDate = account.createdAt || now;
          tokenExpiresAt = new Date(baseDate.getTime() + 72 * 60 * 60 * 1000);
          await this.prisma.channelAccount.update({
            where: { id: account.id },
            data: { tokenExpiresAt },
          });
          this.logger.log(
            `[ZaloTokenMonitor] Đã thiết lập tokenExpiresAt mặc định (+72h) cho "${account.displayName}": ${tokenExpiresAt.toISOString()}`,
          );
        }

        const remainingMs = tokenExpiresAt.getTime() - now.getTime();
        const remainingHours = remainingMs / (1000 * 60 * 60);

        // 1. ĐÃ HẾT HẠN (remainingHours <= 0)
        if (remainingHours <= 0) {
          this.logger.warn(
            `[ZaloTokenMonitor] Tài khoản Zalo "${account.displayName}" (${account.id}) đã hết hạn phiên 72h!`,
          );

          await this.prisma.channelAccount.update({
            where: { id: account.id },
            data: {
              isActive: false,
              disconnectedAt: now,
              metadata: {
                ...meta,
                deactivatedReason: 'TOKEN_EXPIRED',
                deactivatedAt: now.toISOString(),
              },
            },
          });

          // Tạo thông báo CRITICAL
          await this.notificationService.create({
            workspaceId: account.workspaceId,
            type: NotificationType.CHANNEL_EXPIRED,
            severity: NotificationSeverity.CRITICAL,
            title: `Phiên đăng nhập Zalo "${account.displayName}" đã hết hạn`,
            content: `Tài khoản Zalo cá nhân "${account.displayName}" đã hết hạn phiên làm việc (72 giờ). Hệ thống đã tự động ngắt kết nối. Vui lòng quét lại mã QR để tiếp tục nhận tin nhắn từ khách hàng mà không bị gián đoạn.`,
            actionUrl: '/settings/channels?reconnect=zalo',
            metadata: {
              channelAccountId: account.id,
              remainingHours: 0,
              reason: 'TOKEN_EXPIRED',
              expiredAt: tokenExpiresAt.toISOString(),
            },
          });

          // Bắn sự kiện realtime
          this.realtime.emit('channel:session_expired', {
            channel: 'ZALO',
            channelAccountId: account.id,
            displayName: account.displayName,
            reason: 'Phiên làm việc 72h đã hết hạn',
            timestamp: now.toISOString(),
          });

          continue;
        }

        // 2. CÒN <= 2 GIỜ: CẢNH BÁO URGENT
        if (remainingHours <= 2) {
          const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
          const existingUrgent = await this.prisma.notification.findFirst({
            where: {
              workspaceId: account.workspaceId,
              type: NotificationType.CHANNEL_EXPIRING,
              severity: NotificationSeverity.URGENT,
              createdAt: { gte: twoHoursAgo },
              metadata: {
                path: ['channelAccountId'],
                equals: account.id,
              },
            },
          });

          if (!existingUrgent) {
            const minutesLeft = Math.max(1, Math.round(remainingHours * 60));
            await this.notificationService.create({
              workspaceId: account.workspaceId,
              type: NotificationType.CHANNEL_EXPIRING,
              severity: NotificationSeverity.URGENT,
              title: `CẢNH BÁO KHẨN: Phiên Zalo "${account.displayName}" sắp hết hạn`,
              content: `Phiên kết nối Zalo cá nhân chỉ còn ${minutesLeft} phút. Hãy bấm "Gia hạn ngay" để quét mã QR làm mới phiên, tránh mất kết nối với khách hàng!`,
              actionUrl: '/settings/channels?reconnect=zalo',
              metadata: {
                channelAccountId: account.id,
                remainingHours,
                soundAlert: true,
                expiresAt: tokenExpiresAt.toISOString(),
              },
            });
            this.logger.warn(`[ZaloTokenMonitor] Đã tạo cảnh báo URGENT cho "${account.displayName}"`);
          }
          continue;
        }

        // 3. CÒN <= 12 GIỜ: CẢNH BÁO WARNING
        if (remainingHours <= 12) {
          const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
          const existingWarning = await this.prisma.notification.findFirst({
            where: {
              workspaceId: account.workspaceId,
              type: NotificationType.CHANNEL_EXPIRING,
              severity: NotificationSeverity.WARNING,
              createdAt: { gte: twelveHoursAgo },
              metadata: {
                path: ['channelAccountId'],
                equals: account.id,
              },
            },
          });

          if (!existingWarning) {
            const hoursLeft = Math.max(1, Math.round(remainingHours));
            await this.notificationService.create({
              workspaceId: account.workspaceId,
              type: NotificationType.CHANNEL_EXPIRING,
              severity: NotificationSeverity.WARNING,
              title: `Cảnh báo: Phiên Zalo "${account.displayName}" còn dưới 12 giờ`,
              content: `Phiên kết nối Zalo cá nhân sẽ hết hạn sau khoảng ${hoursLeft} giờ nữa. Bạn có thể gia hạn sớm bất cứ lúc nào.`,
              actionUrl: '/settings/channels?reconnect=zalo',
              metadata: {
                channelAccountId: account.id,
                remainingHours,
                expiresAt: tokenExpiresAt.toISOString(),
              },
            });
            this.logger.log(`[ZaloTokenMonitor] Đã tạo cảnh báo WARNING cho "${account.displayName}"`);
          }
          continue;
        }

        // 4. CÒN <= 24 GIỜ: THÔNG BÁO INFO
        if (remainingHours <= 24) {
          const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const existingInfo = await this.prisma.notification.findFirst({
            where: {
              workspaceId: account.workspaceId,
              type: NotificationType.CHANNEL_EXPIRING,
              severity: NotificationSeverity.INFO,
              createdAt: { gte: twentyFourHoursAgo },
              metadata: {
                path: ['channelAccountId'],
                equals: account.id,
              },
            },
          });

          if (!existingInfo) {
            const hoursLeft = Math.max(1, Math.round(remainingHours));
            await this.notificationService.create({
              workspaceId: account.workspaceId,
              type: NotificationType.CHANNEL_EXPIRING,
              severity: NotificationSeverity.INFO,
              title: `Nhắc nhở: Phiên Zalo "${account.displayName}" còn 24 giờ`,
              content: `Phiên kết nối Zalo cá nhân của "${account.displayName}" sẽ hết hạn sau khoảng ${hoursLeft} giờ nữa. Hãy chú ý lịch làm việc để gia hạn kịp thời.`,
              actionUrl: '/settings/channels?reconnect=zalo',
              metadata: {
                channelAccountId: account.id,
                remainingHours,
                expiresAt: tokenExpiresAt.toISOString(),
              },
            });
            this.logger.log(`[ZaloTokenMonitor] Đã tạo thông báo INFO cho "${account.displayName}"`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`[ZaloTokenMonitor] Lỗi khi quét tài khoản Zalo: ${(error as Error).message}`);
    }
  }
}
