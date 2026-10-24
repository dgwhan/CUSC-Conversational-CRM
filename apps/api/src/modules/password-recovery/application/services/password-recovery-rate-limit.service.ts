import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { Prisma, PasswordRecoveryRateLimitScope } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../platform/database/prisma.service.js';

class RateLimitExceededError extends Error {}

@Injectable()
// Tăng bộ đếm trong transaction Serializable để các request đồng thời không vượt hạn mức.
export class PasswordRecoveryRateLimitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async consume(
    scope: PasswordRecoveryRateLimitScope,
    keyHash: string,
    windowStart: Date,
    expiresAt: Date,
    limit: number,
    now: Date,
  ): Promise<boolean> {
    const maxRetries = this.configService.getOrThrow<number>(
      'PASSWORD_RECOVERY_RATE_LIMIT_SERIALIZATION_RETRY_LIMIT',
    );
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        await this.prisma.$transaction(
          async (transaction) => {
            const bucket =
              await transaction.passwordRecoveryRateLimitBucket.upsert({
                where: {
                  scope_keyHash_windowStart: { scope, keyHash, windowStart },
                },
                create: {
                  id: randomUUID(),
                  scope,
                  keyHash,
                  windowStart,
                  count: 1,
                  expiresAt,
                  createdAt: now,
                  updatedAt: now,
                },
                update: { count: { increment: 1 }, updatedAt: now },
                select: { count: true },
              });

            if (bucket.count > limit) {
              throw new RateLimitExceededError();
            }
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        return true;
      } catch (error: unknown) {
        if (error instanceof RateLimitExceededError) return false;

        const isSerializationConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';
        if (!isSerializationConflict) throw error;
        if (attempt === maxRetries) throw error;
      }
    }

    return false;
  }
}
