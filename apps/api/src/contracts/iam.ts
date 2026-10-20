import { email, z } from 'zod';

export const StaffRoleSchema = z.enum(['ADMIN', 'MANAGER', 'STAFF']);

export const LoginSchema = z.object({
    email: z.string().email().toLowerCase(),
    password: z.string().min(1),
});

export const RefreshSchema = z.object({ refreshToken: z.string().min(1)});

export const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(10).max(128),
});

export const CreateStaffSchema = z.object({
    email: z.string().email().toLowerCase(),
    fullName: z.string().min(1).max(100),
    role: StaffRoleSchema.default('STAFF'),
});

export const UpdateStaffSchema = z.object({
    email: z.string().email().toLowerCase().optional(),
    fullName: z.string().min(1).max(100).optional(),
    role: StaffRoleSchema.optional(),
}).refine((v) => Object.keys(v).length > 0, "Must be least one field");

export const SetTelegramChatIdSchema = z.object({
    telegramChatId: z.string().regex(/^-?\d+$/, 'telegram_chat_id must be a number').nullable(),
});

export type StaffRole = z.infer<typeof StaffRoleSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
export type CreateStaffDto = z.infer<typeof CreateStaffSchema>;
export type UpdateStaffDto = z.infer<typeof UpdateStaffSchema>;