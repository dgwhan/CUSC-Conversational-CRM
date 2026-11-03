import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import type { ZcaSafetyConfig } from './zca-personal.service.js';

/**
 * ZcaRateLimitService — Kiểm soát tần suất gửi tin nhắn Zalo Cá nhân
 *
 * Trách nhiệm duy nhất: Anti-ban / rate limiting / safety config.
 * Tách ra khỏi ZcaPersonalService để tuân thủ Single Responsibility Principle.
 *
 * Các cơ chế bảo vệ:
 * 1. Human Delay ngẫu nhiên giữa 2 tin nhắn (2.5s–4.5s mặc định)
 * 2. Giới hạn tối đa 15 tin nhắn / phút
 * 3. Giới hạn tin nhắn người lạ mỗi ngày
 * 4. Auto-cooldown khi phát hiện dấu hiệu spam
 */
@Injectable()
export class ZcaRateLimitService {
  private readonly logger = new Logger(ZcaRateLimitService.name);

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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

