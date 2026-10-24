import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type AppRole = 'OWNER' | 'ADMIN' | 'AGENT';

/**
 * Decorator xác định các vai trò được phép truy cập endpoint
 * Ví dụ: @Roles('OWNER', 'ADMIN')
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
