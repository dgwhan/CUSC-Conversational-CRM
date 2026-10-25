import { describe, expect, it } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import {
  JwtTokenService,
  type JwtSettings,
} from '../../src/platform/config/jwt.config.js';

describe('JwtTokenService', () => {
  it('should generate token with expected claims, issuer, audience and expiration', () => {
    const customSettings: JwtSettings = {
      Key: 'test_secret_key_with_at_least_32_characters_long',
      Issuer: 'CUSC-Test-Issuer',
      Audience: 'CUSC-Test-Audience',
      ExpiresInMinutes: 30,
    };

    const jwtService = new JwtService({ secret: customSettings.Key });
    const tokenService = new JwtTokenService(
      {
        get: (key: string) => {
          if (key === 'JWT_ACCESS_SECRET') return customSettings.Key;
          if (key === 'JWT_ISSUER') return customSettings.Issuer;
          if (key === 'JWT_AUDIENCE') return customSettings.Audience;
          if (key === 'JWT_EXPIRES_IN_MINUTES')
            return customSettings.ExpiresInMinutes;
          return undefined;
        },
      } as any,
      jwtService,
    );

    const user = {
      id: 'staff-uuid-001',
      email: 'staff@cusc.vn',
      fullName: 'Nguyen Van A',
      role: 'STAFF',
      tokenVersion: 1,
    };

    const result = tokenService.GenerateToken(user);

    expect(result.accessToken).toBeDefined();
    expect(typeof result.accessToken).toBe('string');
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const decoded = jwtService.verify(result.accessToken, {
      secret: customSettings.Key,
      issuer: customSettings.Issuer,
      audience: customSettings.Audience,
    });

    expect(decoded.sub).toBe('staff-uuid-001');
    expect(decoded.unique_name).toBe('Nguyen Van A');
    expect(decoded.email).toBe('staff@cusc.vn');
    expect(decoded.role).toBe('STAFF');
    expect(decoded.tokenVersion).toBe(1);
    expect(decoded.jti).toBeDefined();
    expect(decoded.iss).toBe('CUSC-Test-Issuer');
    expect(decoded.aud).toBe('CUSC-Test-Audience');
  });

  it('should throw an error if JWT_ACCESS_SECRET is missing for security', () => {
    const originalSecret = process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_ACCESS_SECRET;
    try {
      expect(() => new JwtTokenService()).toThrowError(
        /JWT_ACCESS_SECRET không được để trống hoặc thiếu cấu hình/,
      );
    } finally {
      if (originalSecret) process.env.JWT_ACCESS_SECRET = originalSecret;
    }
  });

  it('should support alias generateToken as well', () => {
    const mockConfig = {
      get: (k: string) =>
        k === 'JWT_ACCESS_SECRET' ? 'test_secret_key_32_characters_long_min' : undefined,
    } as any;
    const tokenService = new JwtTokenService(mockConfig);
    const result = tokenService.generateToken({
      id: 'staff-uuid-002',
      email: 'staff2@cusc.vn',
      username: 'staff2_user',
    });

    expect(result.accessToken).toBeDefined();
    expect(result.expiresAt).toBeDefined();
  });
});
