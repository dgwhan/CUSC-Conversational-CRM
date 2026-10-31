export interface WorkspaceHotlineResponseDto {
  id: string;
  workspaceId: string;
  phoneNumber: string;
  label: string;
  department: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  status: 'ACTIVE' | 'INACTIVE';
  workingHours?: string;
  isDefault?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeleteHotlineResponseDto {
  success: boolean;
  message: string;
}

// Aliases for compatibility
export type WorkspaceHotline = WorkspaceHotlineResponseDto;
export type WorkspaceHotlinesResponseDto = WorkspaceHotlineResponseDto[];
