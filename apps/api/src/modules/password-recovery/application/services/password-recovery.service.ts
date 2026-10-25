import {
  PASSWORD_RECOVERY_CHALLENGE_STATUS,
  PASSWORD_RECOVERY_DELIVERY_STATUS,
} from '../../domain/password-recovery.constants.js';
import { STAFF_STATUS } from '../../../auth/domain/staff-status.constants.js';
import {
  BadRequestException,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PasswordRecoveryRateLimitScope } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../platform/database/prisma.service.js';
import { PasswordRecoveryCryptoService } from '../../infrastructure/crypto/password-recovery-crypto.service.js';
import { PasswordRecoveryRateLimitService } from './password-recovery-rate-limit.service.js';
import { PasswordRecoveryDeliveryProcessor } from './password-recovery-delivery-processor.service.js';

const INITIAL_DELIVERY_GENERATION = 1;

type LockedStaff = {
  id: string;
  status: string;
};

function safeErrorCategory(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^P\d{4}$/.test(error.code)
  ) {
    return error.code;
  }

  return error instanceof Error ? error.name : 'UnknownError';
}

@Injectable()
// Điều phối yêu cầu OTP, kiểm tra điều kiện staff và tạo challenge/outbox.
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cryptoService: PasswordRecoveryCryptoService,
    private readonly rateLimitService: PasswordRecoveryRateLimitService,
    private readonly deliveryProcessor: PasswordRecoveryDeliveryProcessor,
  ) { }

  async requestOtp(email: string, ipAddress: string): Promise<void> {
    // Chỉ lưu định danh HMAC và OTP mã hóa; không ghi OTP thô vào database/log.
    const normalizedEmail = email.trim().toLowerCase();
    const emailKey = this.cryptoService.createEmailKey(normalizedEmail);
    const ipKey = this.cryptoService.createIpKey(ipAddress.trim());
    const challengeId = randomUUID();
    const otp = this.cryptoService.generateOtp();
    const generation = INITIAL_DELIVERY_GENERATION;
    const otpVerifier = this.cryptoService.createOtpVerifier(challengeId, otp);
    const otpCiphertext = this.cryptoService.encryptOtp(
      challengeId,
      generation,
      otp,
    );
    const requestWindowSeconds = this.configService.getOrThrow<number>('PASSWORD_RECOVERY_RATE_WINDOW_SECONDS');
    const requestWindowMs = requestWindowSeconds * 1000;
    const cooldownSeconds = this.configService.getOrThrow<number>('PASSWORD_RECOVERY_RESEND_COOLDOWN_SECONDS');
    const cooldownMs = cooldownSeconds * 1000;
    let stage = 'database_clock';

    try {
      const clockRows = await this.prisma.$queryRaw<Array<{ now: Date }>>(
        Prisma.sql`SELECT clock_timestamp() AS "now"`,
      );
      const requestTime = clockRows[0]?.now;
      if (!requestTime) {
        throw new Error('Database clock is unavailable');
      }

      const windowStart = new Date(Math.floor(requestTime.getTime() / requestWindowMs) * requestWindowMs);
      const windowExpiresAt = new Date(windowStart.getTime() + requestWindowMs);

      stage = 'ip_rate_limit';
      const ipAllowed = await this.rateLimitService.consume(
        PasswordRecoveryRateLimitScope.IP_REQUEST,
        ipKey,
        windowStart,
        windowExpiresAt,
        this.configService.getOrThrow<number>('PASSWORD_RECOVERY_IP_REQUEST_LIMIT'),
        requestTime,
      );

      if (!ipAllowed) {
        this.logger.warn('Password recovery request rate-limited');
        throw new HttpException(
          'Too many recovery requests. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      stage = 'email_rate_limit';
      const emailAllowed = await this.rateLimitService.consume(
        PasswordRecoveryRateLimitScope.EMAIL_REQUEST,
        emailKey,
        windowStart,
        windowExpiresAt,
        this.configService.getOrThrow<number>('PASSWORD_RECOVERY_EMAIL_REQUEST_LIMIT'),
        requestTime,
      );

      if (!emailAllowed) {
        this.logger.warn('Password recovery request rate-limited');
        throw new HttpException(
          'Too many recovery requests. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      stage = 'challenge_transaction';
      await this.prisma.$transaction(
        async (transaction) => {
          stage = 'email_advisory_lock';
          await transaction.$queryRaw(
            Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${emailKey}, 0))`,
          );

          stage = 'challenge_clock';
          const clockRows = await transaction.$queryRaw<Array<{ now: Date }>>(
            Prisma.sql`SELECT clock_timestamp() AS "now"`,
          );
          const now = clockRows[0]?.now;
          if (!now) throw new Error('Database clock is unavailable');

          stage = 'pending_challenge_lookup';
          const pendingChallenge =
            await transaction.passwordRecoveryChallenge.findFirst({
              where: {
                emailKey,
                status: PASSWORD_RECOVERY_CHALLENGE_STATUS.PENDING_SEND,
                deliveries: {
                  some: {
                    status: { in: [PASSWORD_RECOVERY_DELIVERY_STATUS.PENDING, PASSWORD_RECOVERY_DELIVERY_STATUS.SENDING, PASSWORD_RECOVERY_DELIVERY_STATUS.RETRY_WAIT] },
                  },
                },
              },
              select: { id: true },
            });

          if (pendingChallenge) return 'accepted';

          stage = 'successful_send_cooldown_lookup';
          const lastSuccessfulChallenge =
            await transaction.passwordRecoveryChallenge.findFirst({
              where: {
                emailKey,
                lastSuccessfulSendAt: { not: null },
              },
              orderBy: { lastSuccessfulSendAt: 'desc' },
              select: { lastSuccessfulSendAt: true },
            });

          if (
            lastSuccessfulChallenge?.lastSuccessfulSendAt &&
            now.getTime() -
            lastSuccessfulChallenge.lastSuccessfulSendAt.getTime() <
            cooldownMs
          ) {
            // Cooldown tính từ lần gửi thành công gần nhất, không tính lần yêu cầu.
            return 'accepted';
          }

          stage = 'active_staff_lock';
          const staffRows = await transaction.$queryRaw<LockedStaff[]>(
            Prisma.sql`SELECT "id", "status"::text AS "status" FROM "staff" WHERE "email" = ${normalizedEmail} FOR UPDATE`,
          );
          const staff = staffRows[0];

          if (!staff || staff.status !== STAFF_STATUS.ACTIVE) {
            stage = 'ineligible_challenge_create';
            await transaction.passwordRecoveryChallenge.create({
              data: {
                id: challengeId,
                emailKey,
                emailKeyVersion: this.cryptoService.emailKeyVersion,
                status: PASSWORD_RECOVERY_CHALLENGE_STATUS.INELIGIBLE,
              },
            });

            return 'accepted';
          }

          stage = 'challenge_create';
          await transaction.passwordRecoveryChallenge.create({
            data: {
              id: challengeId,
              staffId: staff.id,
              emailKey,
              emailKeyVersion: this.cryptoService.emailKeyVersion,
              status: PASSWORD_RECOVERY_CHALLENGE_STATUS.PENDING_SEND,
            },
          });

          stage = 'delivery_create';
          await transaction.passwordRecoveryDelivery.create({
            data: {
              challengeId,
              generation,
              otpVerifier,
              otpCiphertext: Uint8Array.from(otpCiphertext),
              otpKeyVersion: this.cryptoService.otpKeyVersion,
              ciphertextKeyVersion: this.cryptoService.ciphertextKeyVersion,
            },
          });

          return 'accepted';
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );

      this.logger.log('Password recovery request processed');
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(
          `\n🔑 ========================================\n🔑 [TEST / DEV OTP] Email: ${normalizedEmail}\n🔑 MÃ XÁC MINH OTP: ${otp}\n🔑 ========================================\n`,
        );
      }

      // Xử lý ngay outbox delivery mà không phải đợi timer 5s polling
      void this.deliveryProcessor.processBatch();
    } catch (error: unknown) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        throw error;
      }

      this.logger.error(`Password recovery request failed at ${stage} (${safeErrorCategory(error)})`);
      throw new ServiceUnavailableException('Password recovery request is temporarily unavailable');
    }
  }

  async resetPassword(
    resetToken: string,
    newPassword: string,
    ipAddress: string,
  ): Promise<{ success: true; message: string }> {
    const ipKey = this.cryptoService.createIpKey(ipAddress.trim());
    let stage = 'database_clock';

    try {
      const clockRows = await this.prisma.$queryRaw<Array<{ now: Date }>>(
        Prisma.sql`SELECT clock_timestamp() AS "now"`,
      );
      const now = clockRows[0]?.now;
      if (!now) throw new Error('Database clock is unavailable');

      // Rate limit IP_RESET
      const windowSeconds = this.configService.getOrThrow<number>(
        'PASSWORD_RECOVERY_RATE_WINDOW_SECONDS',
      );
      const windowMs = windowSeconds * 1000;
      const windowStart = new Date(
        Math.floor(now.getTime() / windowMs) * windowMs,
      );
      const ipAllowed = await this.rateLimitService.consume(
        PasswordRecoveryRateLimitScope.IP_RESET,
        ipKey,
        windowStart,
        new Date(windowStart.getTime() + windowMs),
        this.configService.getOrThrow<number>(
          'PASSWORD_RECOVERY_IP_RESET_LIMIT',
        ),
        now,
      );

      if (!ipAllowed) {
        this.logger.warn('Password reset rate-limited');
        throw new HttpException(
          'Too many password reset attempts. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      stage = 'token_verification';
      const tokenHash = this.cryptoService.hashResetToken(resetToken.trim());

      // Tìm challenge có resetTokenHash khớp
      const challenge = await this.prisma.passwordRecoveryChallenge.findFirst({
        where: {
          resetTokenHash: tokenHash,
        },
        include: { staff: true },
      });

      if (
        !challenge ||
        challenge.status !== PASSWORD_RECOVERY_CHALLENGE_STATUS.VERIFIED ||
        challenge.consumedAt !== null ||
        !challenge.resetTokenExpiresAt ||
        challenge.resetTokenExpiresAt <= now ||
        !challenge.staffId ||
        !challenge.staff ||
        challenge.staff.status !== STAFF_STATUS.ACTIVE
      ) {
        this.logger.warn('Password reset attempt rejected: invalid or expired token');
        throw new BadRequestException('Mã xác minh đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
      }

      stage = 'password_hashing';
      const passwordHash = await argon2.hash(newPassword);

      stage = 'reset_transaction';
      await this.prisma.$transaction(
        async (tx) => {
          // Bảo đảm tính nguyên tử & Chống Replay Attack: Chỉ cập nhật nếu token chưa bị ai dùng trước đó
          const updateResult = await tx.passwordRecoveryChallenge.updateMany({
            where: {
              id: challenge.id,
              status: PASSWORD_RECOVERY_CHALLENGE_STATUS.VERIFIED,
              consumedAt: null,
              resetTokenExpiresAt: { gt: now },
            },
            data: {
              status: PASSWORD_RECOVERY_CHALLENGE_STATUS.COMPLETED,
              consumedAt: now,
              resetTokenHash: null, // Xóa hash để triệt tiêu hoàn toàn khả năng replay
            },
          });

          if (updateResult.count !== 1) {
            throw new BadRequestException('Mã xác minh đã được sử dụng hoặc đã hết hạn.');
          }

          // Cập nhật mật khẩu mới cho staff và reset số lần đăng nhập sai
          await tx.staff.update({
            where: { id: challenge.staffId! },
            data: {
              passwordHash,
              failedLoginAttempts: 0,
              lockedUntil: null,
            },
          });

          // Thu hồi (revoke) toàn bộ refresh token / phiên đăng nhập cũ của nhân viên
          await tx.refreshToken.updateMany({
            where: {
              staffId: challenge.staffId!,
              revokedAt: null,
            },
            data: {
              revokedAt: now,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );

      this.logger.log('Password reset successfully completed and active sessions revoked');
      return {
        success: true,
        message: 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
      };
    } catch (error: unknown) {
      if (
        error instanceof HttpException &&
        [HttpStatus.BAD_REQUEST, HttpStatus.TOO_MANY_REQUESTS].includes(
          error.getStatus(),
        )
      ) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new BadRequestException('Mã xác minh đã được sử dụng hoặc đã hết hạn.');
      }

      this.logger.error(`Password reset failed at ${stage} (${safeErrorCategory(error)})`);
      throw new ServiceUnavailableException('Dịch vụ đặt lại mật khẩu tạm thời gián đoạn');
    }
  }
}
