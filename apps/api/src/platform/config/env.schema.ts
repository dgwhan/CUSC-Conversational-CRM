import { z } from 'zod';

const DEV_DEFAULT_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const DEV_DEFAULT_JWT_SECRET = 'daylasecretkeysieucapbimat32kytu';

const optionalTrimmedString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

const optionalPort = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const optionalBoolean = z.preprocess(
  (value) => {
    if (value === '' || value === undefined) return undefined;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return value.trim().toLowerCase();
    return value;
  },
  z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional()
    .default(false),
);

const encryptionKey = z.string().refine((value) => {
  const decoded = Buffer.from(value, 'base64');
  return decoded.length === 32 && decoded.toString('base64') === value;
}, 'must be a base64-encoded 32-byte key');

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
    // Mail (SMTP)
    MAIL_HOST: optionalTrimmedString,
    MAIL_PORT: optionalPort,
    MAIL_SECURE: optionalBoolean,
    MAIL_USER: optionalTrimmedString,
    MAIL_PASSWORD: optionalTrimmedString,
    MAIL_FROM: optionalTrimmedString,
    // Password Recovery
    PASSWORD_RECOVERY_EMAIL_HMAC_KEY: encryptionKey,
    PASSWORD_RECOVERY_OTP_HMAC_KEY: encryptionKey,
    PASSWORD_RECOVERY_OTP_ENCRYPTION_KEY: encryptionKey,
    PASSWORD_RECOVERY_IP_REQUEST_LIMIT: z.coerce
      .number()
      .int()
      .positive()
      .default(20),
    PASSWORD_RECOVERY_EMAIL_REQUEST_LIMIT: z.coerce
      .number()
      .int()
      .positive()
      .default(5),
    PASSWORD_RECOVERY_IP_VERIFY_LIMIT: z.coerce
      .number()
      .int()
      .positive()
      .default(20),
    PASSWORD_RECOVERY_IP_RESET_LIMIT: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
    PASSWORD_RECOVERY_RESET_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(900),
    PASSWORD_RECOVERY_RATE_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(900),
    PASSWORD_RECOVERY_RESEND_COOLDOWN_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60),
    PASSWORD_RECOVERY_DELIVERY_POLL_INTERVAL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(5),
    PASSWORD_RECOVERY_DELIVERY_LEASE_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60),
    PASSWORD_RECOVERY_DELIVERY_MAX_ATTEMPTS: z.coerce
      .number()
      .int()
      .positive()
      .default(5),
    PASSWORD_RECOVERY_DELIVERY_RETRY_BASE_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(30),
    PASSWORD_RECOVERY_DELIVERY_BATCH_SIZE: z.coerce
      .number()
      .int()
      .positive()
      .default(20),
    PASSWORD_RECOVERY_DELIVERY_MAX_RETRY_DELAY_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(3600),
    PASSWORD_RECOVERY_CHALLENGE_STATE_RETRY_LIMIT: z.coerce
      .number()
      .int()
      .positive()
      .default(20),
    PASSWORD_RECOVERY_RATE_LIMIT_SERIALIZATION_RETRY_LIMIT: z.coerce
      .number()
      .int()
      .positive()
      .default(3),
    // Social integrations (from main)
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
  .superRefine((config, context) => {
    // Mail validation
    const hasMailSettings = Boolean(
      config.MAIL_HOST ||
      config.MAIL_PORT ||
      config.MAIL_USER ||
      config.MAIL_PASSWORD ||
      config.MAIL_FROM,
    );

    if (hasMailSettings && !config.MAIL_HOST) {
      context.addIssue({
        code: 'custom',
        path: ['MAIL_HOST'],
        message: 'MAIL_HOST is required when SMTP is configured',
      });
    }
    if (hasMailSettings && !config.MAIL_PORT) {
      context.addIssue({
        code: 'custom',
        path: ['MAIL_PORT'],
        message: 'MAIL_PORT is required when SMTP is configured',
      });
    }
    if (hasMailSettings && !config.MAIL_FROM) {
      context.addIssue({
        code: 'custom',
        path: ['MAIL_FROM'],
        message: 'MAIL_FROM is required when SMTP is configured',
      });
    }
    if (Boolean(config.MAIL_USER) !== Boolean(config.MAIL_PASSWORD)) {
      context.addIssue({
        code: 'custom',
        path: ['MAIL_PASSWORD'],
        message: 'MAIL_USER and MAIL_PASSWORD must be provided together',
      });
    }

    // Production security checks (from main)
    if (config.NODE_ENV === 'production') {
      if (config.TOKEN_ENCRYPTION_KEY === DEV_DEFAULT_ENCRYPTION_KEY) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['TOKEN_ENCRYPTION_KEY'],
          message:
            'In production, TOKEN_ENCRYPTION_KEY must be a unique, cryptographically strong secret (not the default dev key)',
        });
      }
      if (config.JWT_ACCESS_SECRET === DEV_DEFAULT_JWT_SECRET) {
        context.addIssue({
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
      .map(
        (issue) => `  - [${issue.path.join('.') || 'ENV'}]: ${issue.message}`,
      )
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
