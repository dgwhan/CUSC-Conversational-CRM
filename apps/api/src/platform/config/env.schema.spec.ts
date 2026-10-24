import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.schema.js';

const recoveryKeys = {
  PASSWORD_RECOVERY_EMAIL_HMAC_KEY: Buffer.alloc(32, 1).toString('base64'),
  PASSWORD_RECOVERY_OTP_HMAC_KEY: Buffer.alloc(32, 2).toString('base64'),
  PASSWORD_RECOVERY_OTP_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
};

describe('validateEnv', () => {
  it('should throw an error with clear message when DATABASE_URL is missing', () => {
    const invalidConfig = {
      NODE_ENV: 'development',
      PORT: '3000',
    };

    expect(() => validateEnv(invalidConfig)).toThrowError(
      /DATABASE_URL is required/,
    );
  });

  it('should throw an error when DATABASE_URL is empty', () => {
    const invalidConfig = {
      DATABASE_URL: '',
    };

    expect(() => validateEnv(invalidConfig)).toThrowError(
      /DATABASE_URL cannot be empty/,
    );
  });

  it('should validate and parse valid environment configuration successfully', () => {
    const validConfig = {
      ...recoveryKeys,
      DATABASE_URL:
        'postgresql://postgres:postgres@localhost:5432/crm?schema=public',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      PORT: '4000',
      NODE_ENV: 'production',
    };

    const parsed = validateEnv(validConfig);
    expect(parsed.DATABASE_URL).toBe(
      'postgresql://postgres:postgres@localhost:5432/crm?schema=public',
    );
    expect(parsed.PORT).toBe(4000);
    expect(parsed.NODE_ENV).toBe('production');
    expect(parsed.PASSWORD_RECOVERY_DELIVERY_POLL_INTERVAL_SECONDS).toBe(5);
    expect(parsed.PASSWORD_RECOVERY_IP_VERIFY_LIMIT).toBe(20);
    expect(parsed.PASSWORD_RECOVERY_DELIVERY_LEASE_SECONDS).toBe(60);
    expect(parsed.PASSWORD_RECOVERY_DELIVERY_MAX_ATTEMPTS).toBe(5);
    expect(parsed.PASSWORD_RECOVERY_DELIVERY_RETRY_BASE_SECONDS).toBe(30);
    expect(parsed.PASSWORD_RECOVERY_DELIVERY_BATCH_SIZE).toBe(20);
    expect(parsed.PASSWORD_RECOVERY_DELIVERY_MAX_RETRY_DELAY_SECONDS).toBe(
      3600,
    );
    expect(parsed.PASSWORD_RECOVERY_CHALLENGE_STATE_RETRY_LIMIT).toBe(20);
    expect(
      parsed.PASSWORD_RECOVERY_RATE_LIMIT_SERIALIZATION_RETRY_LIMIT,
    ).toBe(3);
    expect(parsed.MAIL_SECURE).toBe(false);
  });

  it('should accept a complete SMTP configuration', () => {
    const parsed = validateEnv({
      ...recoveryKeys,
      DATABASE_URL:
        'postgresql://postgres:postgres@localhost:5432/crm?schema=public',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      MAIL_HOST: 'smtp.example.com',
      MAIL_PORT: '587',
      MAIL_SECURE: 'false',
      MAIL_USER: 'mailer',
      MAIL_PASSWORD: 'test-password',
      MAIL_FROM: 'Recruitment CRM <no-reply@example.com>',
    });

    expect(parsed.MAIL_HOST).toBe('smtp.example.com');
    expect(parsed.MAIL_PORT).toBe(587);
    expect(parsed.MAIL_SECURE).toBe(false);
    expect(parsed.MAIL_USER).toBe('mailer');
    expect(parsed.MAIL_FROM).toBe('Recruitment CRM <no-reply@example.com>');
  });

  it('should reject incomplete SMTP configuration', () => {
    expect(() =>
      validateEnv({
        ...recoveryKeys,
        DATABASE_URL:
          'postgresql://postgres:postgres@localhost:5432/crm?schema=public',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        MAIL_HOST: 'smtp.example.com',
      }),
    ).toThrowError(/MAIL_PORT is required when SMTP is configured/);
  });

  it('should require SMTP username and password together', () => {
    expect(() =>
      validateEnv({
        ...recoveryKeys,
        DATABASE_URL:
          'postgresql://postgres:postgres@localhost:5432/crm?schema=public',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        MAIL_HOST: 'smtp.example.com',
        MAIL_PORT: '587',
        MAIL_FROM: 'no-reply@example.com',
        MAIL_USER: 'mailer',
      }),
    ).toThrowError(/MAIL_USER and MAIL_PASSWORD must be provided together/);
  });

  it('should treat blank SMTP settings as disabled', () => {
    const parsed = validateEnv({
      ...recoveryKeys,
      DATABASE_URL:
        'postgresql://postgres:postgres@localhost:5432/crm?schema=public',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      MAIL_HOST: '',
      MAIL_PORT: '',
      MAIL_SECURE: 'false',
      MAIL_USER: '',
      MAIL_PASSWORD: '',
      MAIL_FROM: '',
    });

    expect(parsed.MAIL_HOST).toBeUndefined();
    expect(parsed.MAIL_PORT).toBeUndefined();
    expect(parsed.MAIL_SECURE).toBe(false);
  });

  it('should require recovery keys to decode to exactly 32 bytes', () => {
    expect(() =>
      validateEnv({
        ...recoveryKeys,
        DATABASE_URL:
          'postgresql://postgres:postgres@localhost:5432/crm?schema=public',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        PASSWORD_RECOVERY_EMAIL_HMAC_KEY: 'not-a-32-byte-key',
      }),
    ).toThrowError(/base64-encoded 32-byte key/);
  });
});
