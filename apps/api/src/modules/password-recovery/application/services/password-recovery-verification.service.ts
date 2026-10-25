import {
  PASSWORD_RECOVERY_CHALLENGE_STATUS,
  PASSWORD_RECOVERY_DELIVERY_STATUS,
  VERIFICATION_RESULT,
  type VerificationResult,
} from '../../domain/password-recovery.constants.js';
import { STAFF_STATUS } from '../../../auth/domain/staff-status.constants.js';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordRecoveryRateLimitScope, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service.js';
import { PasswordRecoveryCryptoService } from '../../infrastructure/crypto/password-recovery-crypto.service.js';
import { PasswordRecoveryRateLimitService } from './password-recovery-rate-limit.service.js';
import { PasswordRecoveryDeliveryProcessor } from './password-recovery-delivery-processor.service.js';

const MAX_OTP_ATTEMPTS = 5;

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
// Xác minh OTP và cập nhật challenge có điều kiện để xử lý request đồng thời an toàn.
export class PasswordRecoveryVerificationService {
  private readonly logger = new Logger(
    PasswordRecoveryVerificationService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cryptoService: PasswordRecoveryCryptoService,
    private readonly rateLimitService: PasswordRecoveryRateLimitService,
    private readonly deliveryProcessor: PasswordRecoveryDeliveryProcessor,
  ) { }

  async verifyOtp(
    email: string,
    otp: string,
    ipAddress: string,
  ): Promise<{ verified: true; resetToken: string }> {
    const emailKey = this.cryptoService.createEmailKey(
      email.trim().toLowerCase(),
    );
    const ipKey = this.cryptoService.createIpKey(ipAddress.trim());

    // Nếu challenge vừa được tạo mà outbox delivery chưa kích hoạt xong, kích hoạt ngay lập tức
    const hasPendingDelivery = await this.prisma.passwordRecoveryChallenge.findFirst({
      where: {
        emailKey,
        status: PASSWORD_RECOVERY_CHALLENGE_STATUS.PENDING_SEND,
      },
      select: { id: true },
    });
    if (hasPendingDelivery) {
      await this.deliveryProcessor.processBatch();
    }
    let stage = 'database_clock';

    try {
      const clockRows = await this.prisma.$queryRaw<Array<{ now: Date }>>(
        Prisma.sql`SELECT clock_timestamp() AS "now"`,
      );
      const now = clockRows[0]?.now;
      if (!now) throw new Error('Database clock is unavailable');

      const windowSeconds = this.configService.getOrThrow<number>(
        'PASSWORD_RECOVERY_RATE_WINDOW_SECONDS',
      );
      const windowMs = windowSeconds * 1000;
      const windowStart = new Date(
        Math.floor(now.getTime() / windowMs) * windowMs,
      );
      const ipAllowed = await this.rateLimitService.consume(
        PasswordRecoveryRateLimitScope.IP_VERIFY,
        ipKey,
        windowStart,
        new Date(windowStart.getTime() + windowMs),
        this.configService.getOrThrow<number>(
          'PASSWORD_RECOVERY_IP_VERIFY_LIMIT',
        ),
        now,
      );

      if (!ipAllowed) {
        this.logger.warn('Password recovery verification rate-limited');
        throw new HttpException(
          'Too many verification attempts. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const maxStateRetries = this.configService.getOrThrow<number>(
        'PASSWORD_RECOVERY_CHALLENGE_STATE_RETRY_LIMIT',
      );
      for (let attempt = 0; attempt < maxStateRetries; attempt += 1) {
        stage = 'challenge_transaction';
        const result = await this.prisma.$transaction(async (transaction) => {
          stage = 'challenge_clock';
          const transactionClockRows = await transaction.$queryRaw<
            Array<{ now: Date }>
          >(Prisma.sql`SELECT clock_timestamp() AS "now"`);
          const transactionNow = transactionClockRows[0]?.now;
          if (!transactionNow) {
            throw new Error('Database clock is unavailable');
          }

          stage = 'challenge_lookup';
          const challenge =
            await transaction.passwordRecoveryChallenge.findFirst({
              where: {
                emailKey,
                status: PASSWORD_RECOVERY_CHALLENGE_STATUS.PENDING_VERIFICATION,
              },
              orderBy: { lastSuccessfulSendAt: 'desc' },
              select: {
                id: true,
                failedAttempts: true,
                expiresAt: true,
                staff: { select: { status: true } },
                deliveries: {
                  where: { status: PASSWORD_RECOVERY_DELIVERY_STATUS.SENT },
                  orderBy: { generation: 'desc' },
                  take: 1,
                  select: { otpVerifier: true },
                },
              },
            });

          if (!challenge) return { type: VERIFICATION_RESULT.INVALID } as const;

          const currentState = {
            id: challenge.id,
            status: PASSWORD_RECOVERY_CHALLENGE_STATUS.PENDING_VERIFICATION,
            failedAttempts: challenge.failedAttempts,
          };

          // Challenge hết hạn hoặc đã đủ lượt sai thì không được xác minh tiếp.
          if (!challenge.expiresAt || challenge.expiresAt <= transactionNow) {
            stage = 'challenge_expire';
            const expired =
              await transaction.passwordRecoveryChallenge.updateMany({
                where: currentState,
                data: { status: PASSWORD_RECOVERY_CHALLENGE_STATUS.EXPIRED },
              });
            return expired.count === 1
              ? ({ type: VERIFICATION_RESULT.INVALID } as const)
              : ({ type: VERIFICATION_RESULT.RETRY } as const);
          }

          if (
            challenge.failedAttempts >= MAX_OTP_ATTEMPTS ||
            challenge.staff?.status !== STAFF_STATUS.ACTIVE
          ) {
            stage = 'challenge_lock';
            const locked =
              await transaction.passwordRecoveryChallenge.updateMany({
                where: currentState,
                data: { status: PASSWORD_RECOVERY_CHALLENGE_STATUS.LOCKED },
              });
            return locked.count === 1
              ? ({ type: VERIFICATION_RESULT.INVALID } as const)
              : ({ type: VERIFICATION_RESULT.RETRY } as const);
          }

          const verifier = challenge.deliveries[0]?.otpVerifier;
          const matches = verifier !== undefined && this.cryptoService.verifyOtp(challenge.id, otp, verifier);
          const nextFailedAttempts = challenge.failedAttempts + 1;

          stage = matches ? 'challenge_verify' : 'challenge_failed_attempt';
          // Compare-and-set theo số lượt sai; chỉ một request đồng thời cập nhật được.
          let issuedResetToken: string | undefined;
          let resetTokenHash: string | undefined;
          let resetTokenExpiresAt: Date | undefined;

          if (matches) {
            issuedResetToken = this.cryptoService.generateResetToken();
            resetTokenHash = this.cryptoService.hashResetToken(issuedResetToken);
            const tokenTtlSeconds = this.configService.getOrThrow<number>(
              'PASSWORD_RECOVERY_RESET_TOKEN_TTL_SECONDS',
            );
            resetTokenExpiresAt = new Date(
              transactionNow.getTime() + tokenTtlSeconds * 1000,
            );
          }

          const updated =
            await transaction.passwordRecoveryChallenge.updateMany({
              where: {
                ...currentState,
                failedAttempts: {
                  equals: challenge.failedAttempts,
                  lt: MAX_OTP_ATTEMPTS,
                },
                expiresAt: { gt: transactionNow },
              },
              data: matches
                ? {
                  status: PASSWORD_RECOVERY_CHALLENGE_STATUS.VERIFIED,
                  verifiedAt: transactionNow,
                  resetTokenHash,
                  resetTokenExpiresAt,
                }
                : {
                  failedAttempts: { increment: 1 },
                  status:
                    nextFailedAttempts >= MAX_OTP_ATTEMPTS
                      ? PASSWORD_RECOVERY_CHALLENGE_STATUS.LOCKED
                      : PASSWORD_RECOVERY_CHALLENGE_STATUS.PENDING_VERIFICATION,
                },
            });

          return updated.count === 1
            ? matches
              ? ({ type: VERIFICATION_RESULT.VERIFIED, resetToken: issuedResetToken! } as const)
              : ({ type: VERIFICATION_RESULT.INVALID } as const)
            : ({ type: VERIFICATION_RESULT.RETRY } as const);
        });

        if (result.type === 'retry') continue;
        if (result.type === 'invalid') {
          this.logger.warn('Password recovery verification rejected');
          throw new BadRequestException('Invalid or expired verification code');
        }

        this.logger.log('Password recovery OTP verified, reset token issued');
        return { verified: true, resetToken: result.resetToken };
      }

      throw new ServiceUnavailableException('Password recovery verification is temporarily unavailable',);
    } catch (error: unknown) {
      if (
        error instanceof HttpException &&
        [HttpStatus.BAD_REQUEST, HttpStatus.TOO_MANY_REQUESTS].includes(
          error.getStatus(),
        )
      ) {
        throw error;
      }

      if (error instanceof ServiceUnavailableException) throw error;

      this.logger.error(`Password recovery verification failed at ${stage} (${safeErrorCategory(error)})`,);
      throw new ServiceUnavailableException(
        'Password recovery verification is temporarily unavailable',
      );
    }
  }
}
