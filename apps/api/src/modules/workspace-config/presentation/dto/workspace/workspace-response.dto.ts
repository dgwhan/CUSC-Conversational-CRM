export interface WorkspaceItemResponseDto {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'STAFF';
  isOwner: boolean;
  domain: string;
  ownerId?: string;
  ownerName: string;
  createdAt: Date;
}

export interface DeleteWorkspaceResponseDto {
  success: boolean;
  message: string;
}

// Aliases for compatibility
export type WorkspaceResponseDto = WorkspaceItemResponseDto;
export type MyWorkspacesResponseDto = WorkspaceItemResponseDto[];
