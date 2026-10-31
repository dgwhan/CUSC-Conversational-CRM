import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { Prisma } from '@prisma/client';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/platform/database/prisma.service.js';
import { PasswordRecoveryCryptoService } from '../../src/modules/password-recovery/infrastructure/crypto/password-recovery-crypto.service.js';
import { PASSWORD_RECOVERY_CHALLENGE_STATUS } from '../../src/modules/password-recovery/domain/password-recovery.constants.js';
import { STAFF_STATUS } from '../../src/modules/auth/domain/staff-status.constants.js';

describe('Password Recovery Reset Token (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let prisma: PrismaService;
  let cryptoService: PasswordRecoveryCryptoService;

  const testStaffId = '11111111-2222-4333-8444-555555555555';
  const testStaffEmail = 'reset-test@cusc.ctu.edu.vn';

  async function getDbNow(): Promise<Date> {
    const rows = await prisma.$queryRaw<Array<{ now: Date }>>(
      Prisma.sql`SELECT clock_timestamp() AS "now"`,
    );
    return rows[0]!.now;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
    cryptoService = app.get(PasswordRecoveryCryptoService);

    // Chuẩn bị user mẫu trong DB
    await prisma.user.upsert({
      where: { id: testStaffId },
      create: {
        id: testStaffId,
        email: testStaffEmail,
        passwordHash: 'old-hash-placeholder',
        fullName: 'Reset Test User',
        status: STAFF_STATUS.ACTIVE,
      },
      update: {
        email: testStaffEmail,
        passwordHash: 'old-hash-placeholder',
        status: STAFF_STATUS.ACTIVE,
      },
    });
  });

  beforeEach(async () => {
    // Xóa rate limit buckets giữa các test để tránh ảnh hưởng lẫn nhau
    await prisma.passwordRecoveryRateLimitBucket.deleteMany();
  });

  afterAll(async () => {
    // Dọn dẹp dữ liệu test
    if (prisma) {
      await prisma.refreshToken.deleteMany({ where: { userId: testStaffId } });
      const emailKey = cryptoService.createEmailKey(testStaffEmail);
      await prisma.passwordRecoveryChallenge.deleteMany({ where: { emailKey } });
      await prisma.user.deleteMany({ where: { id: testStaffId } });
      await prisma.passwordRecoveryRateLimitBucket.deleteMany();
    }
    if (app) await app.close();
  });

  function server(): App {
    if (!app) throw new Error('Test application was not initialized');
    return app.getHttpServer();
  }

  it('1. Cấp resetToken sau khi xác minh OTP hợp lệ', async () => {
    const dbNow = await getDbNow();
    const emailKey = cryptoService.createEmailKey(testStaffEmail);
    const otp = '123456';
    const challengeId = '22222222-3333-4444-8555-666666666666';
    const otpVerifier = cryptoService.createOtpVerifier(challengeId, otp);

    // Tạo challenge PENDING_VERIFICATION kèm delivery SENT
    await prisma.passwordRecoveryChallenge.create({
      data: {
        id: challengeId,
        userId: testStaffId,
        emailKey,
        emailKeyVersion: cryptoService.emailKeyVersion,
        status: PASSWORD_RECOVERY_CHALLENGE_STATUS.PENDING_VERIFICATION,
        expiresAt: new Date(dbNow.getTime() + 10 * 60 * 1000),
        lastSuccessfulSendAt: dbNow,
        deliveries: {
          create: {
            generation: 1,
            otpVerifier,
            status: 'SENT',
            otpKeyVersion: cryptoService.otpKeyVersion,
            ciphertextKeyVersion: cryptoService.ciphertextKeyVersion,
          },
        },
      },
    });

    const res = await request(server())
      .post('/api/auth/password-recovery/verify')
      .send({ email: testStaffEmail, otp });

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(typeof res.body.resetToken).toBe('string');
    expect(res.body.resetToken.length).toBeGreaterThan(20);

    // Kiểm tra DB đã được cập nhật status VERIFIED và có resetTokenHash
    const updatedChallenge = await prisma.passwordRecoveryChallenge.findUnique({
      where: { id: challengeId },
    });
    expect(updatedChallenge?.status).toBe(PASSWORD_RECOVERY_CHALLENGE_STATUS.VERIFIED);
    expect(updatedChallenge?.resetTokenHash).toBe(cryptoService.hashResetToken(res.body.resetToken));
    expect(updatedChallenge?.resetTokenExpiresAt).toBeDefined();
  });

  it('2. Đặt lại mật khẩu thành công: hash mật khẩu mới, cập nhật DB và thu hồi refresh tokens', async () => {
    const dbNow = await getDbNow();
    const token = cryptoService.generateResetToken();
    const tokenHash = cryptoService.hashResetToken(token);
    const challengeId = '33333333-4444-4555-8666-777777777777';

    // Tạo challenge đã VERIFIED
    await prisma.passwordRecoveryChallenge.create({
      data: {
        id: challengeId,
        userId: testStaffId,
        emailKey: cryptoService.createEmailKey(testStaffEmail),
        emailKeyVersion: cryptoService.emailKeyVersion,
        status: PASSWORD_RECOVERY_CHALLENGE_STATUS.VERIFIED,
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: new Date(dbNow.getTime() + 15 * 60 * 1000),
        expiresAt: new Date(dbNow.getTime() + 15 * 60 * 1000),
      },
    });

    // Tạo sẵn 2 refresh tokens active của nhân viên
    await prisma.refreshToken.createMany({
      data: [
        {
          userId: testStaffId,
          familyId: '44444444-5555-4666-8777-888888888881',
          tokenHash: 'active-token-hash-1',
          expiresAt: new Date(dbNow.getTime() + 7 * 24 * 3600 * 1000),
        },
        {
          userId: testStaffId,
          familyId: '44444444-5555-4666-8777-888888888882',
          tokenHash: 'active-token-hash-2',
          expiresAt: new Date(dbNow.getTime() + 7 * 24 * 3600 * 1000),
        },
      ],
    });

    const res = await request(server())
      .post('/api/auth/password-recovery/reset')
      .send({
        resetToken: token,
        newPassword: 'NewSecurePassword123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Kiểm tra challenge đã COMPLETED và consumedAt đã được ghi nhận
    const challenge = await prisma.passwordRecoveryChallenge.findUnique({
      where: { id: challengeId },
    });
    expect(challenge?.status).toBe(PASSWORD_RECOVERY_CHALLENGE_STATUS.COMPLETED);
    expect(challenge?.consumedAt).not.toBeNull();
    expect(challenge?.resetTokenHash).toBeNull(); // Hash đã bị xóa để chống replay

    // Kiểm tra mật khẩu staff đã thay đổi khác với old-hash-placeholder
    const staff = await prisma.user.findUnique({ where: { id: testStaffId } });
    expect(staff?.passwordHash).not.toBe('old-hash-placeholder');

    // Kiểm tra tất cả refresh tokens của staff đã bị thu hồi (revokedAt !== null)
    const activeTokens = await prisma.refreshToken.findMany({
      where: { userId: testStaffId, revokedAt: null },
    });
    expect(activeTokens.length).toBe(0);
  });

  it('3. Từ chối token sai / không tồn tại', async () => {
    const res = await request(server())
      .post('/api/auth/password-recovery/reset')
      .send({
        resetToken: 'invalid-non-existent-token-1234567890',
        newPassword: 'NewSecurePassword123!',
      });

    expect(res.status).toBe(400);
  });

  it('4. Từ chối token đã hết hạn', async () => {
    const dbNow = await getDbNow();
    const token = cryptoService.generateResetToken();
    const tokenHash = cryptoService.hashResetToken(token);
    const challengeId = '55555555-6666-4777-8888-999999999999';

    // Tạo challenge có resetTokenExpiresAt trong quá khứ theo giờ DB
    await prisma.passwordRecoveryChallenge.create({
      data: {
        id: challengeId,
        userId: testStaffId,
        emailKey: cryptoService.createEmailKey(testStaffEmail),
        emailKeyVersion: cryptoService.emailKeyVersion,
        status: PASSWORD_RECOVERY_CHALLENGE_STATUS.VERIFIED,
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: new Date(dbNow.getTime() - 60 * 1000), // Đã hết hạn 1 phút trước
        expiresAt: new Date(dbNow.getTime() - 60 * 1000),
      },
    });

    const res = await request(server())
      .post('/api/auth/password-recovery/reset')
      .send({
        resetToken: token,
        newPassword: 'NewSecurePassword123!',
      });

    expect(res.status).toBe(400);
  });

  it('5. Chống Replay Attack: Không cho phép token được sử dụng thành công hai lần', async () => {
    const dbNow = await getDbNow();
    const token = cryptoService.generateResetToken();
    const tokenHash = cryptoService.hashResetToken(token);
    const challengeId = '66666666-7777-4888-8999-000000000000';

    await prisma.passwordRecoveryChallenge.create({
      data: {
        id: challengeId,
        userId: testStaffId,
        emailKey: cryptoService.createEmailKey(testStaffEmail),
        emailKeyVersion: cryptoService.emailKeyVersion,
        status: PASSWORD_RECOVERY_CHALLENGE_STATUS.VERIFIED,
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: new Date(dbNow.getTime() + 15 * 60 * 1000),
        expiresAt: new Date(dbNow.getTime() + 15 * 60 * 1000),
      },
    });

    // Lần 1: Thành công
    const firstAttempt = await request(server())
      .post('/api/auth/password-recovery/reset')
      .send({
        resetToken: token,
        newPassword: 'FirstValidPassword123!',
      });
    expect(firstAttempt.status).toBe(200);

    // Lần 2: Thử dùng lại cùng token -> Phải bị từ chối 400
    const secondAttempt = await request(server())
      .post('/api/auth/password-recovery/reset')
      .send({
        resetToken: token,
        newPassword: 'SecondHackerPassword123!',
      });
    expect(secondAttempt.status).toBe(400);
  });

  it('6. Bảo đảm tính nguyên tử khi có 2 request đồng thời (Race Condition)', async () => {
    const dbNow = await getDbNow();
    const token = cryptoService.generateResetToken();
    const tokenHash = cryptoService.hashResetToken(token);
    const challengeId = '77777777-8888-4999-8000-111111111111';

    await prisma.passwordRecoveryChallenge.create({
      data: {
        id: challengeId,
        userId: testStaffId,
        emailKey: cryptoService.createEmailKey(testStaffEmail),
        emailKeyVersion: cryptoService.emailKeyVersion,
        status: PASSWORD_RECOVERY_CHALLENGE_STATUS.VERIFIED,
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: new Date(dbNow.getTime() + 15 * 60 * 1000),
        expiresAt: new Date(dbNow.getTime() + 15 * 60 * 1000),
      },
    });

    // Bắn 2 request reset đồng thời cùng 1 lúc
    const [res1, res2] = await Promise.all([
      request(server())
        .post('/api/auth/password-recovery/reset')
        .send({ resetToken: token, newPassword: 'ConcurrentPasswordA123!' }),
      request(server())
        .post('/api/auth/password-recovery/reset')
        .send({ resetToken: token, newPassword: 'ConcurrentPasswordB123!' }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Một request phải thành công (200), request kia phải thất bại (400)
    expect(statuses).toEqual([200, 400]);
  });

  it('7. Từ chối mật khẩu không đáp ứng tiêu chuẩn độ mạnh (Zod Validation)', async () => {
    const res = await request(server())
      .post('/api/auth/password-recovery/reset')
      .send({
        resetToken: 'some-token',
        newPassword: 'weak', // Dưới 8 ký tự, không có số/chữ hoa/ký tự đặc biệt
      });

    expect(res.status).toBe(400);
  });
});
