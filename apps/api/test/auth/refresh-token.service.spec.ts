import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenService } from '../../src/modules/auth/application/services/refresh-token.service.js';
import { createHash } from 'node:crypto';

describe('RefreshTokenService - Broken Access Token Protection', () => {
  const createMockService = (overrides = {}) => {
    const mockPrisma: any = {
      refreshToken: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      staff: {
        update: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
      ...overrides,
    };

    const mockJwtTokenService: any = {
      GenerateToken: vi.fn().mockReturnValue({
        accessToken: 'mock_new_access_token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      }),
    };

    const mockConfigService: any = {
      getOrThrow: vi.fn().mockReturnValue(7),
    };

    const mockAuditService: any = {
      recordEvent: vi.fn().mockResolvedValue(undefined),
    };

    const service = new RefreshTokenService(
      mockPrisma,
      mockJwtTokenService,
      mockConfigService,
      mockAuditService,
    );

    return { service, mockPrisma, mockJwtTokenService, mockAuditService };
  };

  it('throws UnauthorizedException when refresh token is missing or empty', async () => {
    const { service } = createMockService();
    await expect(service.refresh('', { ip: '127.0.0.1' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('detects token replay attack and revokes entire token family', async () => {
    const { service, mockPrisma, mockAuditService } = createMockService();
    const rawToken = 'revoked_stolen_token';
    const hash = createHash('sha256').update(rawToken).digest('hex');

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-uuid-1',
      familyId: 'family-uuid-123',
      staffId: 'staff-uuid-999',
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 1000000),
      revokedAt: new Date(Date.now() - 5000), // đã bị thu hồi trước đó!
      staff: {
        id: 'staff-uuid-999',
        status: 'ACTIVE',
      },
    });

    await expect(service.refresh(rawToken, { ip: '192.168.1.1' })).rejects.toThrow(
      /Phát hiện Refresh Token bất thường/i,
    );

    // Toàn bộ token family phải bị thu hồi ngay lập tức
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-uuid-123' },
      data: { revokedAt: expect.any(Date) },
    });

    // Audit log sự kiện bảo mật
    expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          reason: 'REFRESH_TOKEN_REUSE_DETECTED',
          familyId: 'family-uuid-123',
        }),
      }),
    );
  });

  it('successfully rotates refresh token and issues new access token', async () => {
    const { service, mockPrisma, mockJwtTokenService } = createMockService();
    const rawToken = 'valid_active_token';
    const hash = createHash('sha256').update(rawToken).digest('hex');

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'old-token-id',
      familyId: 'family-abc',
      staffId: 'staff-1',
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      staff: {
        id: 'staff-1',
        email: 'staff@cusc.vn',
        fullName: 'Tu Van Vien',
        role: 'STAFF',
        status: 'ACTIVE',
        tokenVersion: 2,
        mustChangePassword: false,
        phoneNumber: '0912345678',
        ownerId: 'owner-1',
      },
    });

    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'new-token-id' });
    mockPrisma.refreshToken.update.mockResolvedValue({});

    const result = await service.refresh(rawToken, { ip: '127.0.0.1' });

    expect(result.response.accessToken).toBe('mock_new_access_token');
    expect(result.response.staff.role).toBe('STAFF');
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).not.toBe(rawToken);

    // Old token was revoked with replacedById pointing to new token
    expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'old-token-id' },
      data: {
        revokedAt: expect.any(Date),
        replacedById: 'new-token-id',
      },
    });

    // New JWT was signed with current tokenVersion
    expect(mockJwtTokenService.GenerateToken).toHaveBeenCalledWith({
      id: 'staff-1',
      email: 'staff@cusc.vn',
      fullName: 'Tu Van Vien',
      role: 'STAFF',
      tokenVersion: 2,
    });
  });
});
