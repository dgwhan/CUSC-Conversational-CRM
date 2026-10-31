import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StaffRoleSchema, type StaffRole } from '../../../../contracts/iam.js';
import type { AuthUser } from '../../domain/types/auth-user.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<StaffRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (roles === undefined) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;

    if (!user || !user.role || !StaffRoleSchema.safeParse(user.role).success) {
      throw new UnauthorizedException();
    }

    if (!roles.includes(user.role)) {
      throw new NotFoundException();
    }

    return true;
  }
}
