import { z } from 'zod';

// Chuẩn hóa email trước khi xử lý và từ chối thuộc tính không được khai báo.
export const requestPasswordRecoverySchema = z
  .object({
    email: z
      .string()
      .trim()
      .pipe(z.email())
      .transform((email) => email.toLowerCase()),
  })
  .strict();

export type RequestPasswordRecoveryDto = z.infer<
  typeof requestPasswordRecoverySchema
>;

// OTP được giữ dạng chuỗi để bảo toàn số 0 ở đầu và phải có đúng sáu chữ số.
export const verifyPasswordRecoveryOtpSchema = z
  .object({
    email: z
      .string()
      .trim()
      .pipe(z.email())
      .transform((email) => email.toLowerCase()),
    otp: z.string().regex(/^\d{6}$/),
  })
  .strict();

export type VerifyPasswordRecoveryOtpDto = z.infer<
  typeof verifyPasswordRecoveryOtpSchema
>;
