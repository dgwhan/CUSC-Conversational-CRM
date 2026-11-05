import { Injectable, OnModuleDestroy } from '@nestjs/common';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

interface ClientRecord {
  timestamps: number[];
  lastSeen: number;
}

/**
 * Service quản lý Rate Limiting sử dụng thuật toán Sliding Window Log (In-Memory).
 * Tối ưu hiệu năng cao (O(1) amortized), tự động dọn dẹp các IP hết hạn định kỳ
 * để ngăn chặn rò rỉ bộ nhớ (Memory Leak) và chống tấn công DDoS/Brute-force.
 */
@Injectable()
export class RateLimiterService implements OnModuleDestroy {
  private readonly records = new Map<string, ClientRecord>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor() {
    // Dọn dẹp các IP đã quá hạn sau mỗi 60 giây
    this.cleanupTimer = setInterval(() => this.cleanupExpiredRecords(), 60_000);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Kiểm tra và ghi nhận lượt truy cập của client
   * @param key Khóa định danh client (ví dụ: client IP + route identifier)
   * @param limit Số lượng request tối đa trong cửa sổ thời gian
   * @param ttlMs Độ dài cửa sổ thời gian (milliseconds), mặc định 60,000ms (1 phút)
   */
  checkLimit(key: string, limit: number = 120, ttlMs: number = 60_000): RateLimitResult {
    const now = Date.now();
    const windowStart = now - ttlMs;

    let record = this.records.get(key);
    if (!record) {
      record = { timestamps: [], lastSeen: now };
      this.records.set(key, record);
    }

    record.lastSeen = now;

    // Loại bỏ các request đã nằm ngoài cửa sổ sliding window
    const validTimestamps = record.timestamps.filter((ts) => ts > windowStart);
    record.timestamps = validTimestamps;

    const currentCount = validTimestamps.length;
    const oldestTimestamp = validTimestamps[0] ?? now;
    const resetInSeconds = Math.max(1, Math.ceil((oldestTimestamp + ttlMs - now) / 1000));

    if (currentCount >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetInSeconds,
      };
    }

    // Ghi nhận request hiện tại
    record.timestamps.push(now);

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - record.timestamps.length),
      resetInSeconds,
    };
  }

  /**
   * Xóa sạch các bản ghi đã quá thời gian lưu vết để giải phóng RAM
   */
  cleanupExpiredRecords(maxAgeMs: number = 120_000): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now - record.lastSeen > maxAgeMs) {
        this.records.delete(key);
      }
    }
  }

  /**
   * Reset thủ công (dùng cho unit test hoặc admin unblock)
   */
  reset(key?: string): void {
    if (key) {
      this.records.delete(key);
    } else {
      this.records.clear();
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }
}
