import { z } from 'zod';

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
    MAIL_HOST: optionalTrimmedString,
    MAIL_PORT: optionalPort,
    MAIL_SECURE: optionalBoolean,
    MAIL_USER: optionalTrimmedString,
    MAIL_PASSWORD: optionalTrimmedString,
    MAIL_FROM: optionalTrimmedString,
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
  })
  .superRefine((config, context) => {
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
