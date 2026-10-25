import type { StaffRole } from '../constants/auth.constants.js';

export type { StaffRole };

export type LoginRequest = {
  identifier?: string;
  email?: string;
  phoneNumber?: string;
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
    phoneNumber?: string | null;
  };
};

export type RegisterRequest = {
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  role?: StaffRole;
};

export type RegisterResponse = {
  accessToken: string;
  staff: {
    id: string;
    email: string;
    fullName: string;
    phoneNumber?: string | null;
    role: StaffRole;
  };
};
