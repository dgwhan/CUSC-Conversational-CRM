import { z } from 'zod';

// Mật khẩu mới cần đáp ứng các tiêu chuẩn bảo mật mạnh (chữ hoa, chữ thường, số, ký tự đặc biệt).
export const resetPasswordSchema = z
  .object({
    resetToken: z.string().trim().min(1, 'Mã xác minh đặt lại mật khẩu không được để trống'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
      .max(128, 'Mật khẩu không được vượt quá 128 ký tự')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/,
        'Mật khẩu phải chứa ít nhất một chữ hoa, một chữ thường, một số và một ký tự đặc biệt',
      ),
  })
  .strict();

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
