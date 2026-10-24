export const StaffRole = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
} as const;

export type StaffRole = (typeof StaffRole)[
  keyof typeof StaffRole
];
