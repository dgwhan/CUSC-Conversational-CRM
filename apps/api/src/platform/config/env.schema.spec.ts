import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.schema.js';

describe('validateEnv (Security & Configuration Integrity)', () => {
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

  it('should validate and parse valid environment configuration successfully in development', () => {
    const validConfig = {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/crm?schema=public',
      PORT: '4000',
      NODE_ENV: 'development',
      JWT_ACCESS_SECRET: 'daylasecretkeysieucapbimat32kytu',
    };

    const parsed = validateEnv(validConfig);
    expect(parsed.DATABASE_URL).toBe(
      'postgresql://postgres:postgres@localhost:5432/crm?schema=public',
    );
    expect(parsed.PORT).toBe(4000);
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.JWT_ACCESS_SECRET).toBe('daylasecretkeysieucapbimat32kytu');
  });

  it('should strictly reject default sample keys in production environment', () => {
    const insecureProdConfig = {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/crm?schema=public',
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'daylasecretkeysieucapbimat32kytu', // default sample key
    };

    expect(() => validateEnv(insecureProdConfig)).toThrowError(
      /In production, JWT_ACCESS_SECRET must not use the default sample key/,
    );
  });

  it('should accept secure, unique secrets in production mode', () => {
    const secureProdConfig = {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/crm?schema=public',
      PORT: '3000',
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'production_super_strong_jwt_access_secret_key_12345',
      TOKEN_ENCRYPTION_KEY: 'production_super_strong_token_encryption_key_12345',
      FRONTEND_URL: 'https://crm.cusc.vn',
      APP_BASE_URL: 'https://api.crm.cusc.vn',
    };

    const parsed = validateEnv(secureProdConfig);
    expect(parsed.NODE_ENV).toBe('production');
    expect(parsed.JWT_ACCESS_SECRET).toBe('production_super_strong_jwt_access_secret_key_12345');
    expect(parsed.TOKEN_ENCRYPTION_KEY).toBe('production_super_strong_token_encryption_key_12345');
    expect(parsed.FRONTEND_URL).toBe('https://crm.cusc.vn');
  });
});
