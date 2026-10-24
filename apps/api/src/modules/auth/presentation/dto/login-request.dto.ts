import { z } from 'zod';

export const loginRequestSchema = z
  .object({
    email: z.string().trim().pipe(z.email()),
    password: z.string().min(1),
  })
  .strict();

export type LoginRequestDto = z.infer<typeof loginRequestSchema>;