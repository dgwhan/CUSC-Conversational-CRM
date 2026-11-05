import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RATE_LIMIT_KEY,
  SKIP_RATE_LIMIT_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator.js';
import { RateLimiterService } from '../security/rate-limiter.service.js';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly defaultLimit = 120; // 120 req / phút mặc định
  private readonly defaultTtlMs = 60_000; // 60s

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isSkipped = this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isSkipped) {
      return true;
    }

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    // Trong môi trường test, tự động bỏ qua nếu không có cờ kiểm tra rate limit để tránh ảnh hưởng test suite khác
    if (process.env.NODE_ENV === 'test' && req?.headers?.['x-test-rate-limit'] !== 'true') {
      return true;
    }

    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const limit = options?.limit ?? this.defaultLimit;
    const ttlMs = options?.ttlMs ?? this.defaultTtlMs;

    const clientIp = this.getClientIp(req);
    // Nhóm theo IP và class handler để kiểm soát granular per endpoint nếu có options
    const routeKey = options ? `${context.getClass().name}:${context.getHandler().name}` : 'global';
    const rateLimitKey = `${clientIp}:${routeKey}`;

    const result = this.rateLimiter.checkLimit(rateLimitKey, limit, ttlMs);

    // Gán các header bảo mật Rate Limit tiêu chuẩn (IETF RFC 6585)
    this.setHeader(res, 'X-RateLimit-Limit', String(result.limit));
    this.setHeader(res, 'X-RateLimit-Remaining', String(result.remaining));
    this.setHeader(res, 'X-RateLimit-Reset', String(result.resetInSeconds));

    if (!result.allowed) {
      this.setHeader(res, 'Retry-After', String(result.resetInSeconds));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Hệ thống ghi nhận quá nhiều yêu cầu từ địa chỉ IP của bạn. Vui lòng thử lại sau ${result.resetInSeconds} giây.`,
          retryAfter: result.resetInSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getClientIp(req: any): string {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ips.trim();
    }

    return (
      req.headers?.['x-real-ip'] ||
      req.ip ||
      req.socket?.remoteAddress ||
      req.raw?.socket?.remoteAddress ||
      '127.0.0.1'
    );
  }

  private setHeader(res: any, name: string, value: string): void {
    if (!res) return;
    if (typeof res.header === 'function') {
      res.header(name, value);
    } else if (typeof res.setHeader === 'function') {
      res.setHeader(name, value);
    }
  }
}
