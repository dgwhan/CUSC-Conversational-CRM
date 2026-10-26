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
import { StaffRoleSchema, type StaffRole } from '../../../../contracts/iam.js';
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
        staff: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
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
    const targetStaff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        tokenVersion: true,
      },
    });

    if (!targetStaff) {
      throw new NotFoundException(`Nhân sự với ID ${staffId} không tồn tại`);
    }

    const previousRole = targetStaff.role;
    const newRole = body.role;

    // Cập nhật vai trò và tăng tokenVersion để vô hiệu hóa token cũ nếu vai trò thay đổi
    const updatedStaff = await this.prisma.staff.update({
      where: { id: staffId },
      data: {
        role: newRole,
        tokenVersion: targetStaff.tokenVersion + 1,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    // Ghi audit log sự kiện ROLE_CHANGED
    await this.auditService.recordEvent({
      action: AuditAction.ROLE_CHANGED,
      staffId: targetStaff.id,
      actorId: req.user.id,
      ip,
      userAgent,
      metadata: {
        previousRole,
        newRole,
        staffEmail: targetStaff.email,
        staffFullName: targetStaff.fullName,
      },
    });

    return updatedStaff;
  }
}
