import type { StaffRole } from '../constants/auth.constants.js';

export type { StaffRole };

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  staff: {
    id: string;
    email: string;
    fullName: string;
    role: StaffRole;
    mustChangePassword: boolean;
  };
};
