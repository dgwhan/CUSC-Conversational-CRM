import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { StaffRoleSchema } from '../../contracts/iam.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import type { AuthUser } from './auth-user.js';

type AuthenticatedRequest = Request & { user?: AuthUser };
type AccessTokenPayload = {
  sub?: unknown;
  tokenVersion?: unknown;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const match = /^Bearer\s+([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    );
    if (!match) throw new UnauthorizedException();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(match[1]);
    } catch {
      //sai chữ ký, token hết hạn hoặc không giải mã được
      throw new UnauthorizedException();
    }

    if (
      typeof payload.sub !== 'string' ||
      !Number.isInteger(payload.tokenVersion)
    ) {
      throw new UnauthorizedException();
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        status: true,
        tokenVersion: true,
      },
    });

    if (
      !staff ||
      staff.status !== 'ACTIVE' ||
      staff.tokenVersion !== payload.tokenVersion
    ) {
      throw new UnauthorizedException();
    }

    const role = StaffRoleSchema.safeParse(staff.role);
    if (!role.success) throw new UnauthorizedException();

    request.user = { id: staff.id, role: role.data };
    return true;
  }
}
