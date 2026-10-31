import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../platform/database/prisma.service.js';

export type RecordEventInput = {
  action: AuditAction;
  userId?: string | null;
  staffId?: string | null;
  actorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue | Record<string, unknown> | null;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(input: RecordEventInput) {
    try {
      const resolvedUserId = input.userId ?? input.staffId ?? null;
      return await this.prisma.auditLog.create({
        data: {
          action: input.action,
          userId: resolvedUserId,
          actorId: input.actorId ?? null,
          ip: input.ip ?? null,
          userAgent: input.userAgent?.slice(0, 512) ?? null,
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      // Ghi log lỗi nội bộ, không làm crash flow xác thực của người dùng
      this.logger.error(`Failed to record audit event: ${input.action}`, error);
      return null;
    }
  }

  async getRecentAuditLogs(take = 50) {
    return this.prisma.auditLog.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
  }
}
