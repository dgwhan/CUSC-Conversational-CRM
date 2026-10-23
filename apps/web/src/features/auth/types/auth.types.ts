export type StaffRole = 'ADMIN' | 'MANAGER' | 'STAFF';

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
