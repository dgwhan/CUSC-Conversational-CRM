import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Interceptor thiết lập các HTTP Security Headers tiêu chuẩn của OWASP:
 * - Content-Security-Policy (CSP): Hạn chế các nguồn tài nguyên không an toàn và chống XSS
 * - X-Content-Type-Options: Ngăn chặn trình duyệt đoán định sai MIME-type (MIME-sniffing)
 * - X-Frame-Options: Chống tấn công Clickjacking
 * - X-XSS-Protection: Kích hoạt bộ lọc chống XSS phản xạ ở trình duyệt cũ
 * - Referrer-Policy: Ngăn lộ thông tin URL nhạy cảm qua Referer
 * - Permissions-Policy: Vô hiệu hóa các API phần cứng không cần thiết (camera, micro, geolocation)
 */
@Injectable()
export class SecurityHeadersInterceptor implements NestInterceptor {
  private readonly cspPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' ws: wss: http: https:",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const res = context.switchToHttp().getResponse();

    this.setHeader(res, 'Content-Security-Policy', this.cspPolicy);
    this.setHeader(res, 'X-Content-Type-Options', 'nosniff');
    this.setHeader(res, 'X-Frame-Options', 'SAMEORIGIN');
    this.setHeader(res, 'X-XSS-Protection', '1; mode=block');
    this.setHeader(res, 'Referrer-Policy', 'strict-origin-when-cross-origin');
    this.setHeader(res, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    return next.handle();
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
