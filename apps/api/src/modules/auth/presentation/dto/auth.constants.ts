export const AUTH_VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MIN_FULLNAME_LENGTH: 2,
  MAX_FULLNAME_LENGTH: 100,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^(0|\+84)[0-9]{9}$/,
  DEFAULT_ROLE: 'OWNER' as const,
  MESSAGES: {
    EMAIL_REQUIRED: 'Vui lòng nhập email.',
    EMAIL_INVALID: 'Email không đúng định dạng.',
    PHONE_INVALID:
      'Số điện thoại phải gồm 10 chữ số',
    PASSWORD_REQUIRED: 'Vui lòng nhập mật khẩu.',
    PASSWORD_MIN_LENGTH: 'Mật khẩu phải có ít nhất 8 ký tự.',
    PASSWORD_MAX_LENGTH: 'Mật khẩu không được vượt quá 128 ký tự.',
    FULLNAME_REQUIRED: 'Vui lòng nhập họ và tên.',
    FULLNAME_MIN_LENGTH: 'Họ và tên phải có ít nhất 2 ký tự.',
    FULLNAME_MAX_LENGTH: 'Họ và tên không được vượt quá 100 ký tự.',
    IDENTIFIER_REQUIRED: 'Vui lòng nhập email hoặc số điện thoại.',
    INVALID_CREDENTIALS: 'Email/số điện thoại hoặc mật khẩu không chính xác.',
    EMAIL_EXISTS: 'Email đã được đăng ký trong hệ thống.',
    PHONE_EXISTS: 'Số điện thoại đã được đăng ký trong hệ thống.',
  },
} as const;

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;
export const MAX_SERIALIZATION_RETRIES = 3;
export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
export const SECONDS_PER_DAY = 24 * 60 * 60;
