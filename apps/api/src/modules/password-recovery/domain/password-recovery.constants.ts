// Tập trung các trạng thái riêng của luồng khôi phục mật khẩu.
export const PASSWORD_RECOVERY_CHALLENGE_STATUS = {
  INELIGIBLE: 'INELIGIBLE',
  PENDING_SEND: 'PENDING_SEND',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  VERIFIED: 'VERIFIED',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
  LOCKED: 'LOCKED',
  SUPERSEDED: 'SUPERSEDED',
  SEND_FAILED: 'SEND_FAILED',
} as const;

export const PASSWORD_RECOVERY_DELIVERY_STATUS = {
  PENDING: 'PENDING',
  SENDING: 'SENDING',
  SENT: 'SENT',
  RETRY_WAIT: 'RETRY_WAIT',
  FAILED: 'FAILED',
  SUPERSEDED: 'SUPERSEDED',
} as const;

// Kết quả nội bộ của compare-and-set khi xác minh OTP.
export const VERIFICATION_RESULT = {
  VERIFIED: 'verified',
  INVALID: 'invalid',
  RETRY: 'retry',
} as const;

export type VerificationResult =
  (typeof VERIFICATION_RESULT)[keyof typeof VERIFICATION_RESULT];
