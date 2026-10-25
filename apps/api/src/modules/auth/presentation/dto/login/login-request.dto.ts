import { z } from 'zod';
import { AUTH_VALIDATION } from '../auth.constants.js';

export const loginRequestSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().min(1).optional(),
    phoneNumber: z.string().trim().min(1).optional(),
    password: z.string().min(1, {
      message: AUTH_VALIDATION.MESSAGES.PASSWORD_REQUIRED,
    }),
  })
  .refine(
    (data) => Boolean(data.identifier || data.email || data.phoneNumber),
    {
      message: AUTH_VALIDATION.MESSAGES.IDENTIFIER_REQUIRED,
      path: ['email'],
    },
  );

export type LoginRequestDto = z.infer<typeof loginRequestSchema>;