import { z } from 'zod';
import { StaffRoleSchema } from '../../../../../contracts/iam.js';
import { AUTH_VALIDATION } from '../auth.constants.js';

export const registerRequestSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(AUTH_VALIDATION.MIN_FULLNAME_LENGTH, {
        message: AUTH_VALIDATION.MESSAGES.FULLNAME_MIN_LENGTH,
      })
      .max(AUTH_VALIDATION.MAX_FULLNAME_LENGTH, {
        message: AUTH_VALIDATION.MESSAGES.FULLNAME_MAX_LENGTH,
      }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .regex(AUTH_VALIDATION.EMAIL_REGEX, {
        message: AUTH_VALIDATION.MESSAGES.EMAIL_INVALID,
      }),
    password: z
      .string()
      .min(AUTH_VALIDATION.MIN_PASSWORD_LENGTH, {
        message: AUTH_VALIDATION.MESSAGES.PASSWORD_MIN_LENGTH,
      })
      .max(AUTH_VALIDATION.MAX_PASSWORD_LENGTH, {
        message: AUTH_VALIDATION.MESSAGES.PASSWORD_MAX_LENGTH,
      }),
    phoneNumber: z
      .string()
      .trim()
      .regex(AUTH_VALIDATION.PHONE_REGEX, {
        message: AUTH_VALIDATION.MESSAGES.PHONE_INVALID,
      })
      .optional()
      .or(z.literal('')),
  })
  .strict();

export type RegisterRequestDto = z.infer<typeof registerRequestSchema>;
