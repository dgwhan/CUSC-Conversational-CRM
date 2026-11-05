import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';

/**
 * Pipe làm sạch dữ liệu đầu vào (Input Sanitizer) ngăn chặn tấn công Cross-Site Scripting (XSS).
 * - Đệ quy duyệt qua các trường đối tượng và mảng
 * - Loại bỏ các thẻ thực thi mã: <script>, <iframe>, <object>, <embed>
 * - Loại bỏ các event handler nguy hiểm: onerror=, onload=, onclick=, onmouseover=,...
 * - Vô hiệu hóa javascript: và data:text/html URI pseudoprotocols
 * - Bỏ qua các trường nhạy cảm cần giữ nguyên vẹn (password, tokens, hashes)
 * - Tối ưu hiệu suất, an toàn tuyệt đối với tiếng Việt có dấu và ký tự đặc biệt hợp lệ
 */
@Injectable()
export class XssSanitizerPipe implements PipeTransform {
  // Danh sách các key bỏ qua không sanitize để tránh làm hỏng mật khẩu hoặc chữ ký số
  private readonly ignoredKeys = new Set([
    'password',
    'passwordHash',
    'newPassword',
    'currentPassword',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'rawBody',
    'signature',
  ]);

  transform(value: any, metadata: ArgumentMetadata): any {
    // Chỉ sanitize body, query, params
    if (metadata.type === 'custom') {
      return value;
    }
    return this.sanitizeValue(value);
  }

  private sanitizeValue(value: any, keyName?: string): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (keyName && this.ignoredKeys.has(keyName)) {
      return value;
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item, keyName));
    }

    if (typeof value === 'object' && value.constructor === Object) {
      const sanitizedObj: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitizedObj[key] = this.sanitizeValue(val, key);
      }
      return sanitizedObj;
    }

    return value;
  }

  /**
   * Khử các chuỗi chứa mã script độc hại trong text
   */
  public sanitizeString(text: string): string {
    if (!text || typeof text !== 'string') return text;

    let sanitized = text;

    // 1. Loại bỏ cặp thẻ <script>...</script> (kể cả multiline và hoa/thường)
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // 2. Loại bỏ các thẻ độc hại không được phép trong input text thông thường: <iframe>, <object>, <embed>, <applet>
    sanitized = sanitized.replace(/<\/?(?:iframe|object|embed|applet|meta|link)\b[^>]*>/gi, '');

    // 3. Vô hiệu hóa các pseudo-protocol nguy hiểm: javascript:..., vbscript:..., data:text/html...
    sanitized = sanitized.replace(/(javascript|vbscript|data\s*:\s*text\/html)\s*:/gi, 'blocked:');

    // 4. Loại bỏ các inline event listener nguy hiểm: onerror=..., onload=..., onclick=..., v.v.
    sanitized = sanitized.replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

    return sanitized;
  }
}
