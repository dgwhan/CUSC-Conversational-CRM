import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator.js';

/**
 * Guard bảo vệ hệ thống khỏi tấn công Cross-Site Request Forgery (CSRF).
 * - Các phương thức đọc an toàn (GET, HEAD, OPTIONS) được tự động cho phép theo RFC 7231
 * - Hỗ trợ decorator @SkipCsrf() và miễn trừ các route Webhook bên ngoài (Facebook, Zalo)
 * - Xác thực Origin và Referer đối với các thao tác thay đổi dữ liệu (POST, PUT, PATCH, DELETE)
 * - Yêu cầu sự hiện diện của Custom Header hoặc Bearer Token (trình duyệt không thể tự động đính kèm khi bị tấn công CSRF thông qua HTML Form thông thường)
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: string[] = [];

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    const rawFrontend = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    this.allowedOrigins = rawFrontend
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const method = (req.method || 'GET').toUpperCase();

    // 1. Cho phép các HTTP Safe Methods theo tiêu chuẩn RFC
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    // 2. Kiểm tra nếu controller hoặc route có gắn decorator @SkipCsrf()
    const isSkipped = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isSkipped) {
      return true;
    }

    // 3. Tự động miễn trừ các route webhook từ nhà cung cấp bên thứ ba (Meta, Zalo)
    const url = req.url || req.raw?.url || '';
    if (url.includes('/webhook') || url.includes('/channels/facebook') || url.includes('/channels/zalo')) {
      return true;
    }

    // 4. Kiểm tra Origin Header nếu có
    const origin = req.headers?.['origin'] as string | undefined;
    if (origin) {
      if (!this.isOriginAllowed(origin, req)) {
        throw new ForbiddenException(
          `Lỗi bảo mật CSRF: Origin "${origin}" không được phép thực hiện thao tác này.`,
        );
      }
      return true;
    }

    // 5. Kiểm tra Referer Header nếu không có Origin
    const referer = req.headers?.['referer'] as string | undefined;
    if (referer) {
      try {
        const parsedReferer = new URL(referer);
        const refererOrigin = parsedReferer.origin;
        if (!this.isOriginAllowed(refererOrigin, req)) {
          throw new ForbiddenException(
            `Lỗi bảo mật CSRF: Referer "${refererOrigin}" không được phép thực hiện thao tác này.`,
          );
        }
        return true;
      } catch {
        throw new ForbiddenException('Lỗi bảo mật CSRF: Referer header không hợp lệ.');
      }
    }

    // 6. Nếu cả Origin và Referer đều không có (ví dụ: client native, curl, postman hoặc proxy),
    // yêu cầu phải có Custom Header hoặc Authorization Token chống CSRF giả mạo từ trình duyệt
    const hasCustomHeader = Boolean(
      req.headers?.['authorization'] ||
        req.headers?.['x-workspace-id'] ||
        req.headers?.['x-requested-with'] ||
        req.headers?.['x-user-role'] ||
        req.headers?.['x-staff-id'] ||
        (req.headers?.['content-type'] &&
          String(req.headers['content-type']).includes('application/json')),
    );

    if (!hasCustomHeader) {
      throw new ForbiddenException(
        'Lỗi bảo mật CSRF: Yêu cầu bị từ chối do thiếu thông tin xác thực nguồn gốc hợp lệ.',
      );
    }

    return true;
  }

  private isOriginAllowed(origin: string, req: any): boolean {
    const normalizedOrigin = origin.toLowerCase().trim();

    // Khớp với danh sách allowedOrigins cấu hình trong biến môi trường
    if (this.allowedOrigins.some((allowed) => allowed.toLowerCase() === normalizedOrigin)) {
      return true;
    }

    // Cho phép localhost và 127.0.0.1 trong môi trường dev
    if (
      normalizedOrigin.startsWith('http://localhost:') ||
      normalizedOrigin.startsWith('http://127.0.0.1:') ||
      normalizedOrigin.startsWith('https://localhost:')
    ) {
      return true;
    }

    // Khớp với chính host của server nhận request (Same-Origin)
    const hostHeader = req.headers?.['host'];
    if (hostHeader) {
      const hostUrl = hostHeader.toLowerCase();
      if (
        normalizedOrigin === `http://${hostUrl}` ||
        normalizedOrigin === `https://${hostUrl}`
      ) {
        return true;
      }
    }

    return false;
  }
}
