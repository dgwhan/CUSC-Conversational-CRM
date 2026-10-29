export const USER_ROLES = ['OWNER', 'STAFF'] as const;

export const StaffRole = {
  OWNER: 'OWNER',
  STAFF: 'STAFF',
} as const;

export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole];
export type UserRole = StaffRole;

export const AUTH_TAB = {
  LOGIN: 'login',
  SIGN_UP: 'signup',
} as const;

export type AuthTab = (typeof AUTH_TAB)[keyof typeof AUTH_TAB];
