export interface CreateHotlineRequestDto {
  phoneNumber: string;
  label: string;
  department?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  workingHours?: string;
  isDefault?: boolean;
  notes?: string;
}

export interface UpdateHotlineRequestDto {
  phoneNumber?: string;
  label?: string;
  department?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  workingHours?: string;
  isDefault?: boolean;
  notes?: string;
}

// Aliases for compatibility
export type CreateHotlineDto = CreateHotlineRequestDto;
export type UpdateHotlineDto = UpdateHotlineRequestDto;
