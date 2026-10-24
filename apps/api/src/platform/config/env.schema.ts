import { z } from 'zod';

const DEV_DEFAULT_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const DEV_DEFAULT_JWT_SECRET = 'daylasecretkeysieucapbimat32kytu';

export const envSchema = z
  .object({
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
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
    TOKEN_ENCRYPTION_KEY: z
      .string()
      .min(32, 'TOKEN_ENCRYPTION_KEY must be at least 32 characters')
      .default(DEV_DEFAULT_ENCRYPTION_KEY),
    FRONTEND_URL: z.string().default('http://localhost:5173'),
    APP_BASE_URL: z.string().default('http://localhost:3000'),
    META_APP_ID: z.string().optional(),
    META_APP_SECRET: z.string().optional(),
    META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
    ZALO_APP_ID: z.string().optional(),
    ZALO_APP_SECRET: z.string().optional(),
    TIKTOK_CLIENT_KEY: z.string().optional(),
    TIKTOK_CLIENT_SECRET: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (data.TOKEN_ENCRYPTION_KEY === DEV_DEFAULT_ENCRYPTION_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['TOKEN_ENCRYPTION_KEY'],
          message:
            'In production, TOKEN_ENCRYPTION_KEY must be a unique, cryptographically strong secret (not the default dev key)',
        });
      }
      if (data.JWT_ACCESS_SECRET === DEV_DEFAULT_JWT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_ACCESS_SECRET'],
          message:
            'In production, JWT_ACCESS_SECRET must not use the default sample key',
        });
      }
    }
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
