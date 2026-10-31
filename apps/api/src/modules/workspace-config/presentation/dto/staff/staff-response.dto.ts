export interface StaffItemResponseDto {
  id: string;
  email: string;
  phoneNumber?: string | null;
  fullName: string;
  role: string;
  status: 'ACTIVE' | 'LOCKED';
  ownerId: string | null;
  lockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Aliases for compatibility
export type StaffItemResponse = StaffItemResponseDto;
export type StaffListResponseDto = StaffItemResponseDto[];
