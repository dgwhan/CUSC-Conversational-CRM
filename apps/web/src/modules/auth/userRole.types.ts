import type { LoginResponse } from '../../features/auth/types/auth.types.js';

export type UserRole = 'OWNER' | 'STAFF';

export interface UserRoleContextValue {
  role: UserRole;
  isOwner: boolean;
  isStaff: boolean;
  isAgent: boolean;
  isRoleLocked: boolean;
  staffId: string;
  staffName: string;
  staffEmail: string;
  ownerId: string;
  session: LoginResponse | null;
  isAuthenticated: boolean;
  login: (newSession: LoginResponse) => void;
  logout: () => void;
  setRole: (newRole: UserRole) => void;
  toggleRole: () => void;
}
