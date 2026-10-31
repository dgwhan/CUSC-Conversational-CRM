export interface CreateStaffRequestDto {
  email: string;
  fullName: string;
  phoneNumber?: string;
  password?: string;
  role?: 'STAFF' | 'OWNER';
}

export interface UpdateStaffRequestDto {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
  role?: 'STAFF' | 'OWNER';
}

export interface ToggleStaffLockRequestDto {
  lock: boolean;
}

// Aliases for compatibility
export type CreateStaffDto = CreateStaffRequestDto;
export type UpdateStaffDto = UpdateStaffRequestDto;
export type LockStaffDto = ToggleStaffLockRequestDto;
