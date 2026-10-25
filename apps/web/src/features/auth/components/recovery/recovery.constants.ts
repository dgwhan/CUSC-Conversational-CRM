import { PasswordRecoveryApiError } from '../../api/password-recovery.api.js';

export const OTP_LENGTH = 6;
export const OTP_PATTERN = /^\d{6}$/;
export const RESEND_COOLDOWN_SECONDS = 60;
export const EMAIL_FORMAT_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_UPPERCASE_PATTERN = /[A-Z]/;
export const PASSWORD_LOWERCASE_PATTERN = /[a-z]/;
export const PASSWORD_NUMBER_PATTERN = /[0-9]/;
export const PASSWORD_SPECIAL_CHAR_PATTERN = /[@$!%*?&]/;
export const PASSWORD_SPECIAL_CHAR_LABEL = '@$!%*?&';

export function validateEmail(value: string): string {
  if (!value.trim()) return 'Vui lòng nhập email.';
  if (!EMAIL_FORMAT_PATTERN.test(value.trim())) {
    return 'Vui lòng nhập địa chỉ email hợp lệ.';
  }
  return '';
}

export function validateOtp(otp: string): string {
  if (!OTP_PATTERN.test(otp)) {
    return `Nhập đủ ${OTP_LENGTH} chữ số của mã xác minh.`;
  }
  return '';
}

export function validatePassword(value: string): string {
  if (!value) return 'Vui lòng nhập mật khẩu mới.';
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`;
  }
  if (!PASSWORD_UPPERCASE_PATTERN.test(value)) {
    return 'Mật khẩu phải có ít nhất 1 chữ hoa.';
  }
  if (!PASSWORD_LOWERCASE_PATTERN.test(value)) {
    return 'Mật khẩu phải có ít nhất 1 chữ thường.';
  }
  if (!PASSWORD_NUMBER_PATTERN.test(value)) {
    return 'Mật khẩu phải có ít nhất 1 chữ số.';
  }
  if (!PASSWORD_SPECIAL_CHAR_PATTERN.test(value)) {
    return `Mật khẩu phải có ít nhất 1 ký tự đặc biệt (${PASSWORD_SPECIAL_CHAR_LABEL}).`;
  }
  return '';
}

export function validateConfirmPassword(confirmVal: string, passwordVal: string): string {
  if (!confirmVal) return 'Vui lòng xác nhận mật khẩu mới.';
  if (confirmVal !== passwordVal) return 'Mật khẩu xác nhận không trùng khớp.';
  return '';
}

export type PasswordStrength = {
  score: number;
  label: string;
  colorClass: string;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasUpperLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
};

const STRENGTH_LABELS = ['Yếu', 'Yếu', 'Trung bình', 'Khá mạnh', 'Mạnh'];
const STRENGTH_COLORS = [
  'bg-slate-200 text-text-muted',
  'bg-red-500 text-red-600',
  'bg-amber-500 text-amber-600',
  'bg-brand-primary text-brand-primary',
  'bg-state-success text-state-success',
];

export function calculatePasswordStrength(password: string): PasswordStrength {
  const hasMinLength = password.length >= PASSWORD_MIN_LENGTH;
  const hasUppercase = PASSWORD_UPPERCASE_PATTERN.test(password);
  const hasLowercase = PASSWORD_LOWERCASE_PATTERN.test(password);
  const hasUpperLower = hasUppercase && hasLowercase;
  const hasNumber = PASSWORD_NUMBER_PATTERN.test(password);
  const hasSpecial = PASSWORD_SPECIAL_CHAR_PATTERN.test(password);

  const score = [hasMinLength, hasUpperLower, hasNumber, hasSpecial].filter(Boolean).length;

  return {
    score,
    label: STRENGTH_LABELS[score] || 'Yếu',
    colorClass: STRENGTH_COLORS[score] || STRENGTH_COLORS[0],
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasUpperLower,
    hasNumber,
    hasSpecial,
  };
}

export function getRequestErrorMessage(error: unknown): string {
  if (error instanceof PasswordRecoveryApiError && error.status === 429) {
    return 'Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau.';
  }
  return 'Chưa thể gửi mã xác minh lúc này. Vui lòng thử lại.';
}

export function getVerificationErrorMessage(error: unknown): string {
  if (error instanceof PasswordRecoveryApiError && error.status === 400) {
    return 'Mã xác minh không đúng hoặc đã hết hạn.';
  }
  if (error instanceof PasswordRecoveryApiError && error.status === 429) {
    return 'Bạn đã nhập mã quá nhiều lần. Vui lòng thử lại sau.';
  }
  return 'Không thể xác minh mã lúc này. Vui lòng thử lại.';
}

export function getResetErrorMessage(error: unknown): string {
  if (error instanceof PasswordRecoveryApiError) {
    if (error.status === 400) {
      return (
        error.serverMessage ||
        'Mã xác minh đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng thực hiện lại từ đầu.'
      );
    }
    if (error.status === 429) {
      return 'Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.';
    }
    if (error.serverMessage) {
      return error.serverMessage;
    }
  }
  return 'Chưa thể đặt lại mật khẩu lúc này. Vui lòng thử lại.';
}
