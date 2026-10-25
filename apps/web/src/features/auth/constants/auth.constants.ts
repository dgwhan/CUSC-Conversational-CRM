export const StaffRole = {
  OWNER: 'OWNER',
  STAFF: 'STAFF',
} as const;

export type StaffRole = (typeof StaffRole)[
  keyof typeof StaffRole
];
