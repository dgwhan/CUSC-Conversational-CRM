// Khóa giả dùng chung cho các test; không dùng trong cấu hình chạy ứng dụng.
export const PASSWORD_RECOVERY_TEST_KEYS = {
  PASSWORD_RECOVERY_EMAIL_HMAC_KEY: Buffer.alloc(32, 1).toString('base64'),
  PASSWORD_RECOVERY_OTP_HMAC_KEY: Buffer.alloc(32, 2).toString('base64'),
  PASSWORD_RECOVERY_OTP_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
};
