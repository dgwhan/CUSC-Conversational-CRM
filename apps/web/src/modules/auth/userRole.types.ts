import type { LoginResponse } from '../../features/auth/types/auth.types.js';

export const USER_ROLES = {
  OWNER: 'OWNER',
  STAFF: 'STAFF',
  EMPTY: '',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export interface UserRoleContextValue {
  role: UserRole;
  isOwner: boolean;
  isStaff: boolean;
  isAgent: boolean;
  isRoleLocked: boolean;
  userId: string;
  userName: string;
  userEmail: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  ownerId: string;
  session: LoginResponse | null;
  isAuthenticated: boolean;
  login: (newSession: LoginResponse) => void;
  logout: () => void;
  setRole: (newRole: UserRole, ownerId?: string) => void;
  toggleRole: () => void;
}
