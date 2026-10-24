import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AppRole } from '../decorators/roles.decorator.js';

@Injectable()
export class WorkspaceRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Nếu endpoint không yêu cầu role cụ thể, cho phép truy cập
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    // Lấy role từ JWT user context hoặc header 'x-user-role' (phục vụ mô phỏng / kiểm thử)
    const rawRole =
      request.user?.role ||
      request.headers?.['x-user-role'] ||
      'OWNER'; // Mặc định OWNER nếu chưa gắn header

    const userRole = String(rawRole).toUpperCase() as AppRole;

    const hasRole = requiredRoles.includes(userRole);
    if (!hasRole) {
      throw new ForbiddenException(
        `Bạn không có quyền thực hiện thao tác này. Chức năng này chỉ dành cho: ${requiredRoles.join(', ')} (Hiện tại bạn là: ${userRole}).`,
      );
    }

    return true;
  }
}
