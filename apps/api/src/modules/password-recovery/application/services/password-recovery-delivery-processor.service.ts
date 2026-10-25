import {
  PASSWORD_RECOVERY_CHALLENGE_STATUS,
  PASSWORD_RECOVERY_DELIVERY_STATUS,
} from '../../domain/password-recovery.constants.js';
import { STAFF_STATUS } from '../../../auth/domain/staff-status.constants.js';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../platform/database/prisma.service.js';
import { MailService } from '../../../mail/application/services/mail.service.js';
import { PasswordRecoveryCryptoService } from '../../infrastructure/crypto/password-recovery-crypto.service.js';

const OTP_TTL_SECONDS = 5 * 60;
const EMAIL_SUBJECT = 'Your password recovery code';

type ClaimedDelivery = {
  id: string;
  challengeId: string;
  generation: number;
  attemptCount: number;
  fencingGeneration: bigint;
  leaseOwner: string;
  otpCiphertext: Uint8Array | null;
  ciphertextKeyVersion: number;
  challenge: {
    id: string;
    emailKey: string;
    status: string;
    staff: { id: string; email: string; status: string } | null;
  };
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
//Worker claim outbox, gửi OTP, kích hoạt challenge hoặc lên lịch retry
export class PasswordRecoveryDeliveryProcessor
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PasswordRecoveryDeliveryProcessor.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cryptoService: PasswordRecoveryCryptoService,
    private readonly mailService: MailService,
  ) { }

  onModuleInit(): void {
    const intervalMs =
      this.configService.getOrThrow<number>('PASSWORD_RECOVERY_DELIVERY_POLL_INTERVAL_SECONDS') * 1000;
    this.timer = setInterval(() => void this.processBatch(), intervalMs);
    void this.processBatch();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async processBatch(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const batchSize = this.configService.getOrThrow<number>('PASSWORD_RECOVERY_DELIVERY_BATCH_SIZE');
      for (let index = 0; index < batchSize; index += 1) {
        const delivery = await this.claimNextDelivery();
        if (!delivery) break;
        await this.deliver(delivery);
      }
    } catch (error: unknown) {
      this.logger.debug(`Password recovery delivery batch failed (${safeErrorCategory(error)})`);
    } finally {
      this.running = false;
    }
  }

  private async claimNextDelivery(): Promise<ClaimedDelivery | null> {
    const now = await this.databaseNow();
    const candidate = await this.prisma.passwordRecoveryDelivery.findFirst({
      where: {
        OR: [
          { status: PASSWORD_RECOVERY_DELIVERY_STATUS.PENDING },
          { status: PASSWORD_RECOVERY_DELIVERY_STATUS.RETRY_WAIT, nextAttemptAt: { lte: now } },
          { status: PASSWORD_RECOVERY_DELIVERY_STATUS.SENDING, leaseUntil: { lte: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!candidate) return null;

    const leaseOwner = randomUUID();
    const leaseSeconds = this.configService.getOrThrow<number>('PASSWORD_RECOVERY_DELIVERY_LEASE_SECONDS');
    const claimed = await this.prisma.passwordRecoveryDelivery.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { status: PASSWORD_RECOVERY_DELIVERY_STATUS.PENDING },
          { status: PASSWORD_RECOVERY_DELIVERY_STATUS.RETRY_WAIT, nextAttemptAt: { lte: now } },
          { status: PASSWORD_RECOVERY_DELIVERY_STATUS.SENDING, leaseUntil: { lte: now } },
        ],
      },
      data: {
        status: PASSWORD_RECOVERY_DELIVERY_STATUS.SENDING,
        leaseOwner,
        leaseUntil: new Date(now.getTime() + leaseSeconds * 1000),
        fencingGeneration: { increment: 1 },
        attemptCount: { increment: 1 },
        nextAttemptAt: null,
      },
    });
    // Chỉ worker claim thành công mới được tiếp tục gửi bản ghi này.
    if (claimed.count !== 1) return null;

    const delivery = await this.prisma.passwordRecoveryDelivery.findFirst({
      where: { id: candidate.id, leaseOwner, status: PASSWORD_RECOVERY_DELIVERY_STATUS.SENDING },
      select: {
        id: true,
        challengeId: true,
        generation: true,
        attemptCount: true,
        fencingGeneration: true,
        leaseOwner: true,
        otpCiphertext: true,
        ciphertextKeyVersion: true,
        challenge: {
          select: {
            id: true,
            emailKey: true,
            status: true,
            staff: { select: { id: true, email: true, status: true } },
          },
        },
      },
    });
    if (!delivery || delivery.leaseOwner !== leaseOwner) return null;
    return { ...delivery, leaseOwner };
  }

  private async deliver(delivery: ClaimedDelivery): Promise<void> {
    const staff = delivery.challenge.staff;
    if (
      !staff ||
      staff.status !== STAFF_STATUS.ACTIVE ||
      delivery.challenge.status !== PASSWORD_RECOVERY_CHALLENGE_STATUS.PENDING_SEND ||
      !delivery.otpCiphertext
    ) {
      await this.failPermanently(delivery);
      return;
    }

    let otp: string;
    try {
      otp = this.cryptoService.decryptOtp(
        delivery.challengeId,
        delivery.generation,
        delivery.otpCiphertext,
        delivery.ciphertextKeyVersion,
      );

      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(
          `\n📬 ========================================\n📬 [DELIVERY OTP] Gửi tới: ${staff.email}\n📬 MÃ XÁC MINH OTP: ${otp}\n📬 ========================================\n`,
        );
      }

      await this.mailService.sendEmail({
        from: this.configService.getOrThrow<string>('MAIL_FROM'),
        to: staff.email,
        subject: EMAIL_SUBJECT,
        text: `Your password recovery code is ${otp}. It expires in ${OTP_TTL_SECONDS / 60} minutes. If you did not request this code, you can ignore this email.`,
      });
    } catch {
      this.logger.warn('Password recovery email delivery failed');
      if (process.env.NODE_ENV !== 'production') {
        // Trong môi trường dev: Kích hoạt challenge để dev test được bằng mã OTP trên terminal
        this.logger.log(
          '⚠️ [DEV FALLBACK] Tự động kích hoạt challenge để test OTP trên terminal dù email không gửi được.',
        );
        await this.activateChallenge(delivery);
        return;
      }
      await this.scheduleRetry(delivery);
      return;
    }

    await this.activateChallenge(delivery);
    this.logger.log(
      'Password recovery email delivered and challenge activated',
    );
  }

  private async activateChallenge(delivery: ClaimedDelivery): Promise<void> {
    // Ghi nhận mail đã gửi và kích hoạt OTP trong cùng transaction để mốc TTL chính xác.
    await this.prisma.$transaction(async (transaction) => {
      const now = await this.databaseNow(transaction);
      const sent = await transaction.passwordRecoveryDelivery.updateMany({
        where: {
          id: delivery.id,
          status: PASSWORD_RECOVERY_DELIVERY_STATUS.SENDING,
          leaseOwner: delivery.leaseOwner,
          fencingGeneration: delivery.fencingGeneration,
        },
        data: {
          status: PASSWORD_RECOVERY_DELIVERY_STATUS.SENT,
          sentAt: now,
          otpCiphertext: null,
          nextAttemptAt: null,
          leaseOwner: null,
          leaseUntil: null,
        },
      });
      if (sent.count !== 1)
        throw new Error('Delivery claim is no longer active');

      const activated = await transaction.passwordRecoveryChallenge.updateMany({
        where: { id: delivery.challengeId, status: PASSWORD_RECOVERY_CHALLENGE_STATUS.PENDING_SEND },
        data: {
          status: PASSWORD_RECOVERY_CHALLENGE_STATUS.PENDING_VERIFICATION,
          expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000),
          lastSuccessfulSendAt: now,
          otpKeyVersion: this.cryptoService.otpKeyVersion,
        },
      });
      if (activated.count !== 1)
        throw new Error('Challenge is no longer pending');

      await transaction.passwordRecoveryChallenge.updateMany({
        where: {
          emailKey: delivery.challenge.emailKey,
          id: { not: delivery.challengeId },
          status: PASSWORD_RECOVERY_CHALLENGE_STATUS.PENDING_VERIFICATION,
        },
        data: { status: PASSWORD_RECOVERY_CHALLENGE_STATUS.SUPERSEDED },
      });
    });
  }

  private async scheduleRetry(delivery: ClaimedDelivery): Promise<void> {
    // Retry theo backoff; lần lỗi cuối chuyển delivery và challenge sang trạng thái lỗi.
    const maxAttempts = this.configService.getOrThrow<number>(
      'PASSWORD_RECOVERY_DELIVERY_MAX_ATTEMPTS',
    );
    const isFinalAttempt = delivery.attemptCount >= maxAttempts;
    const now = await this.databaseNow();
    const retryBaseSeconds = this.configService.getOrThrow<number>(
      'PASSWORD_RECOVERY_DELIVERY_RETRY_BASE_SECONDS',
    );
    const retryDelaySeconds = Math.min(
      retryBaseSeconds * 2 ** Math.max(0, delivery.attemptCount - 1),
      this.configService.getOrThrow<number>(
        'PASSWORD_RECOVERY_DELIVERY_MAX_RETRY_DELAY_SECONDS',
      ),
    );

    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.passwordRecoveryDelivery.updateMany({
        where: {
          id: delivery.id,
          status: PASSWORD_RECOVERY_DELIVERY_STATUS.SENDING,
          leaseOwner: delivery.leaseOwner,
          fencingGeneration: delivery.fencingGeneration,
        },
        data: {
          status: isFinalAttempt ? PASSWORD_RECOVERY_DELIVERY_STATUS.FAILED : PASSWORD_RECOVERY_DELIVERY_STATUS.RETRY_WAIT,
          nextAttemptAt: isFinalAttempt
            ? null
            : new Date(now.getTime() + retryDelaySeconds * 1000),
          leaseOwner: null,
          leaseUntil: null,
          ...(isFinalAttempt ? { otpCiphertext: null } : {}),
        },
      });

      if (isFinalAttempt && updated.count === 1) {
        await transaction.passwordRecoveryChallenge.updateMany({
          where: { id: delivery.challengeId, status: PASSWORD_RECOVERY_CHALLENGE_STATUS.PENDING_SEND },
          data: { status: PASSWORD_RECOVERY_CHALLENGE_STATUS.SEND_FAILED },
        });
      }
    });
  }

  private async failPermanently(delivery: ClaimedDelivery): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const failed = await transaction.passwordRecoveryDelivery.updateMany({
        where: {
          id: delivery.id,
          status: PASSWORD_RECOVERY_DELIVERY_STATUS.SENDING,
          leaseOwner: delivery.leaseOwner,
          fencingGeneration: delivery.fencingGeneration,
        },
        data: {
          status: PASSWORD_RECOVERY_DELIVERY_STATUS.FAILED,
          otpCiphertext: null,
          nextAttemptAt: null,
          leaseOwner: null,
          leaseUntil: null,
        },
      });
      if (failed.count === 1) {
        await transaction.passwordRecoveryChallenge.updateMany({
          where: { id: delivery.challengeId, status: PASSWORD_RECOVERY_CHALLENGE_STATUS.PENDING_SEND },
          data: { status: PASSWORD_RECOVERY_CHALLENGE_STATUS.SEND_FAILED },
        });
      }
    });
    this.logger.warn('Password recovery delivery rejected as ineligible');
  }

  private async databaseNow(
    transaction: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Date> {
    const rows = await transaction.$queryRaw<Array<{ now: Date }>>(
      Prisma.sql`SELECT clock_timestamp() AS "now"`,
    );
    const now = rows[0]?.now;
    if (!now) throw new Error('Database clock is unavailable');
    return now;
  }
}
