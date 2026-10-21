import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.schema.js';

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
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/crm?schema=public',
      PORT: '4000',
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'daylasecretkeysieucapbimat32kytu',
    };

    const parsed = validateEnv(validConfig);
    expect(parsed.DATABASE_URL).toBe(
      'postgresql://postgres:postgres@localhost:5432/crm?schema=public',
    );
    expect(parsed.PORT).toBe(4000);
    expect(parsed.NODE_ENV).toBe('production');
    expect(parsed.JWT_ACCESS_SECRET).toBe('daylasecretkeysieucapbimat32kytu');
  });
});
