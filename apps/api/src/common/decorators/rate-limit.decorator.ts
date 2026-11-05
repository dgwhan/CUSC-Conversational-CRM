import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'RATE_LIMIT_OPTIONS';
export const SKIP_RATE_LIMIT_KEY = 'SKIP_RATE_LIMIT';

export interface RateLimitOptions {
  limit: number;
  ttlMs?: number;
}

/**
 * Decorator cấu hình giới hạn số lượng request (Rate Limit) cho controller hoặc route cụ thể.
 * @example
 * @RateLimit({ limit: 10, ttlMs: 60000 }) // Tối đa 10 request / 1 phút
 */
export const RateLimit = (options: RateLimitOptions): CustomDecorator<string> =>
  SetMetadata(RATE_LIMIT_KEY, options);

/**
 * Decorator bỏ qua kiểm tra Rate Limit cho route đặc biệt.
 */
export const SkipRateLimit = (): CustomDecorator<string> =>
  SetMetadata(SKIP_RATE_LIMIT_KEY, true);
