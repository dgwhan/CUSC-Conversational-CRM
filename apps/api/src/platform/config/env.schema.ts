import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL is required' })
    .trim()
    .min(1, 'DATABASE_URL cannot be empty'),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_DB: z.string().optional(),
  POSTGRES_PORT: z.coerce.number().optional(),
  POSTGRES_HOST: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errorMessages = result.error.issues
      .map((issue) => `  - [${issue.path.join('.') || 'ENV'}]: ${issue.message}`)
      .join('\n');

    const formattedError =
      `\n============================================================\n` +
      `ENVIRONMENT CONFIGURATION ERROR:\n` +
      `${errorMessages}\n` +
      `============================================================\n`;

    throw new Error(formattedError);
  }

  return result.data;
}
