import { SetMetadata } from '@nestjs/common';

import type { StaffRole } from '../../contracts/iam.js';

export const ROLES_KEY = 'roles';
export type AppRole = StaffRole;

/**
 * Decorator xác định các vai trò được phép truy cập endpoint
 * Ví dụ: @Roles('OWNER')
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
