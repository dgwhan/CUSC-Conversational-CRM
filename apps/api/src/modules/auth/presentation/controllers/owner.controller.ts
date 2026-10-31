import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  NotFoundException,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../../../platform/database/prisma.service.js';
import { StaffRoleSchema } from '../../../../contracts/iam.js';
import { AuditService } from '../../../audit/audit.service.js';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe.js';
import { Roles } from '../decorators/roles.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import type { AuthUser } from '../../domain/types/auth-user.js';

export const ChangeStaffRoleSchema = z.object({
  role: StaffRoleSchema,
});
export type ChangeStaffRoleDto = z.infer<typeof ChangeStaffRoleSchema>;

@Controller()
export class OwnerController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Get('owner-only')
  @Roles('OWNER')
  @UseGuards(JwtAuthGuard, RolesGuard)
  getOwnerOnly(): { ok: true } {
    return { ok: true };
  }

  @Get('owner/audit-logs')
  @Roles('OWNER')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAuditLogs() {
    return this.prisma.auditLog.findMany({
      take: 50,
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

  @Patch('owner/staff/:id/role')
  @Roles('OWNER')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  async changeStaffRole(
    @Param('id') staffId: string,
    @Body(new ZodValidationPipe(ChangeStaffRoleSchema)) body: ChangeStaffRoleDto,
    @Req() req: { user: AuthUser },
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        email: true,
        fullName: true,
        tokenVersion: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException(`Nhân sự với ID ${staffId} không tồn tại`);
    }

    const newRole = body.role;

    // Cập nhật vai trò trong workspace_members và tăng tokenVersion
    await this.prisma.workspaceMember.updateMany({
      where: { userId: staffId },
      data: {
        role: newRole as any,
      },
    });

    const updatedUser = await this.prisma.user.update({
      where: { id: staffId },
      data: {
        tokenVersion: targetUser.tokenVersion + 1,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    });

    // Ghi audit log sự kiện ROLE_CHANGED
    await this.auditService.recordEvent({
      action: AuditAction.ROLE_CHANGED,
      userId: targetUser.id,
      actorId: req.user.id,
      ip,
      userAgent,
      metadata: {
        newRole,
        staffEmail: targetUser.email,
        staffFullName: targetUser.fullName,
      },
    });

    return {
      ...updatedUser,
      role: newRole,
    };
  }
}
