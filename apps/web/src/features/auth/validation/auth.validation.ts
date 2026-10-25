export const OTP_LENGTH = 6;
export const OTP_PATTERN = /^\d{6}$/;
export const RESEND_COOLDOWN_SECONDS = 60;
export const EMAIL_FORMAT_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_FORMAT_PATTERN = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_UPPERCASE_PATTERN = /[A-Z]/;
export const PASSWORD_LOWERCASE_PATTERN = /[a-z]/;
export const PASSWORD_NUMBER_PATTERN = /[0-9]/;
export const PASSWORD_SPECIAL_CHAR_PATTERN = /[@$!%*?&]/;
export const PASSWORD_SPECIAL_CHAR_LABEL = '@$!%*?&';

export const FULL_NAME_MIN_LENGTH = 2;
export const FULL_NAME_MAX_LENGTH = 100;

export const AUTH_VALIDATION_RULES = {
  MIN_PASSWORD_LENGTH: PASSWORD_MIN_LENGTH,
  MAX_PASSWORD_LENGTH: PASSWORD_MAX_LENGTH,
  MIN_FULL_NAME_LENGTH: FULL_NAME_MIN_LENGTH,
  MAX_FULL_NAME_LENGTH: FULL_NAME_MAX_LENGTH,
  EMAIL_REGEX: EMAIL_FORMAT_PATTERN,
  PHONE_REGEX: PHONE_FORMAT_PATTERN,
  OTP_LENGTH,
  RESEND_COOLDOWN_SECONDS,
} as const;

export const AUTH_MESSAGES = {
  EMAIL_REQUIRED: 'Vui lòng nhập email.',
  EMAIL_INVALID: 'Vui lòng nhập địa chỉ email hợp lệ.',
  PHONE_REQUIRED: 'Vui lòng nhập số điện thoại.',
  PHONE_INVALID: 'Số điện thoại không hợp lệ (ví dụ: 0912345678 hoặc +84912345678).',
  IDENTIFIER_REQUIRED: 'Vui lòng nhập email hoặc số điện thoại.',
  IDENTIFIER_INVALID: 'Vui lòng nhập email hoặc số điện thoại hợp lệ.',
  PASSWORD_REQUIRED: 'Vui lòng nhập mật khẩu.',
  PASSWORD_MIN_LENGTH: `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`,
  PASSWORD_UPPERCASE: 'Mật khẩu phải có ít nhất 1 chữ hoa.',
  PASSWORD_LOWERCASE: 'Mật khẩu phải có ít nhất 1 chữ thường.',
  PASSWORD_NUMBER: 'Mật khẩu phải có ít nhất 1 chữ số.',
  PASSWORD_SPECIAL: `Mật khẩu phải có ít nhất 1 ký tự đặc biệt (${PASSWORD_SPECIAL_CHAR_LABEL}).`,
  PASSWORD_MAX_LENGTH: `Mật khẩu không được vượt quá ${PASSWORD_MAX_LENGTH} ký tự.`,
  CONFIRM_PASSWORD_REQUIRED: 'Vui lòng xác nhận mật khẩu.',
  CONFIRM_PASSWORD_MISMATCH: 'Mật khẩu xác nhận không trùng khớp.',
  FULL_NAME_REQUIRED: 'Vui lòng nhập họ và tên.',
  FULL_NAME_MIN_LENGTH: `Họ và tên phải có ít nhất ${FULL_NAME_MIN_LENGTH} ký tự.`,
  FULL_NAME_MAX_LENGTH: `Họ và tên không được vượt quá ${FULL_NAME_MAX_LENGTH} ký tự.`,
  OTP_INVALID: `Nhập đủ ${OTP_LENGTH} chữ số của mã xác minh.`,
} as const;

export function isEmail(value: string): boolean {
  return EMAIL_FORMAT_PATTERN.test(value.trim());
}

export function isPhone(value: string): boolean {
  return PHONE_FORMAT_PATTERN.test(value.trim());
}

export function validateEmail(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return AUTH_MESSAGES.EMAIL_REQUIRED;
  }
  if (!isEmail(normalized)) {
    return AUTH_MESSAGES.EMAIL_INVALID;
  }
  return '';
}

export function validatePhone(value: string, required = false): string {
  const normalized = value.trim();
  if (!normalized) {
    return required ? AUTH_MESSAGES.PHONE_REQUIRED : '';
  }
  if (!isPhone(normalized)) {
    return AUTH_MESSAGES.PHONE_INVALID;
  }
  return '';
}

export function validateIdentifier(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return AUTH_MESSAGES.IDENTIFIER_REQUIRED;
  }

  // If contains @, validate as email
  if (normalized.includes('@')) {
    if (!isEmail(normalized)) {
      return AUTH_MESSAGES.EMAIL_INVALID;
    }
    return '';
  }

  // Otherwise check phone/digits
  if (/^[0-9+]+$/.test(normalized)) {
    if (!isPhone(normalized)) {
      return AUTH_MESSAGES.PHONE_INVALID;
    }
    return '';
  }

  return AUTH_MESSAGES.IDENTIFIER_INVALID;
}

export function validateOtp(otp: string): string {
  if (!OTP_PATTERN.test(otp)) {
    return AUTH_MESSAGES.OTP_INVALID;
  }
  return '';
}

export function validatePassword(value: string): string {
  if (!value) return AUTH_MESSAGES.PASSWORD_REQUIRED;
  if (value.length < PASSWORD_MIN_LENGTH) {
    return AUTH_MESSAGES.PASSWORD_MIN_LENGTH;
  }
  if (!PASSWORD_UPPERCASE_PATTERN.test(value)) {
    return AUTH_MESSAGES.PASSWORD_UPPERCASE;
  }
  if (!PASSWORD_LOWERCASE_PATTERN.test(value)) {
    return AUTH_MESSAGES.PASSWORD_LOWERCASE;
  }
  if (!PASSWORD_NUMBER_PATTERN.test(value)) {
    return AUTH_MESSAGES.PASSWORD_NUMBER;
  }
  if (!PASSWORD_SPECIAL_CHAR_PATTERN.test(value)) {
    return AUTH_MESSAGES.PASSWORD_SPECIAL;
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return AUTH_MESSAGES.PASSWORD_MAX_LENGTH;
  }
  return '';
}

export function validateConfirmPassword(
  confirmVal: string,
  passwordVal: string,
): string {
  if (!confirmVal) return AUTH_MESSAGES.CONFIRM_PASSWORD_REQUIRED;
  if (confirmVal !== passwordVal) return AUTH_MESSAGES.CONFIRM_PASSWORD_MISMATCH;
  return '';
}

export function validateFullName(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return AUTH_MESSAGES.FULL_NAME_REQUIRED;
  }
  if (normalized.length < FULL_NAME_MIN_LENGTH) {
    return AUTH_MESSAGES.FULL_NAME_MIN_LENGTH;
  }
  if (normalized.length > FULL_NAME_MAX_LENGTH) {
    return AUTH_MESSAGES.FULL_NAME_MAX_LENGTH;
  }
  return '';
}

export const PASSWORD_STRENGTH_LEVEL = {
  EMPTY: '',
  WEAK: 'Yếu',
  STRONG: 'Mạnh',
} as const;

export type PasswordStrengthLevel =
  (typeof PASSWORD_STRENGTH_LEVEL)[keyof typeof PASSWORD_STRENGTH_LEVEL];

export const PASSWORD_STRENGTH_COLOR = {
  EMPTY: 'text-text-secondary',
  WEAK: 'text-state-error',
  STRONG: 'text-state-success',
} as const;

export type PasswordStrength = {
  score: number;
  label: PasswordStrengthLevel;
  colorClass: string;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasUpperLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isStrong: boolean;
};

export function calculatePasswordStrength(password: string): PasswordStrength {
  const hasMinLength = password.length >= PASSWORD_MIN_LENGTH;
  const hasUppercase = PASSWORD_UPPERCASE_PATTERN.test(password);
  const hasLowercase = PASSWORD_LOWERCASE_PATTERN.test(password);
  const hasUpperLower = hasUppercase && hasLowercase;
  const hasNumber = PASSWORD_NUMBER_PATTERN.test(password);
  const hasSpecial = PASSWORD_SPECIAL_CHAR_PATTERN.test(password);

  const isStrong =
    hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  if (!password) {
    return {
      score: 0,
      label: PASSWORD_STRENGTH_LEVEL.EMPTY,
      colorClass: PASSWORD_STRENGTH_COLOR.EMPTY,
      hasMinLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasUpperLower: false,
      hasNumber: false,
      hasSpecial: false,
      isStrong: false,
    };
  }

  const score = [hasMinLength, hasUpperLower, hasNumber, hasSpecial].filter(
    Boolean,
  ).length;

  return {
    score,
    label: isStrong ? PASSWORD_STRENGTH_LEVEL.STRONG : PASSWORD_STRENGTH_LEVEL.WEAK,
    colorClass: isStrong ? PASSWORD_STRENGTH_COLOR.STRONG : PASSWORD_STRENGTH_COLOR.WEAK,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasUpperLower,
    hasNumber,
    hasSpecial,
    isStrong,
  };
}
