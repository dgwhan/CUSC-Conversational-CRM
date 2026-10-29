import { z } from 'zod';

export const refreshRequestSchema = z.object({
    refreshToken: z.string().trim().min(1).optional(),
});

export type RefreshRequestDto = z.infer<typeof refreshRequestSchema>;
