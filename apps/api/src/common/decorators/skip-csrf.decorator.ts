import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const SKIP_CSRF_KEY = 'SKIP_CSRF_KEY';

/**
 * Decorator đánh dấu bỏ qua kiểm tra CSRF cho endpoint.
 * Thường áp dụng cho Server-to-Server webhooks (Meta/Facebook, Zalo) hoặc OAuth redirects.
 */
export const SkipCsrf = (): CustomDecorator<string> => SetMetadata(SKIP_CSRF_KEY, true);
