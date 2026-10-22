import type { StaffRole } from '../../contracts/iam.js';

export type AuthUser = {
  id: string;
  role: StaffRole;
};
