export interface CreateWorkspaceRequestDto {
  name: string;
  domain?: string;
}

export interface UpdateWorkspaceRequestDto {
  name?: string;
  domain?: string;
}

// Aliases for compatibility
export type CreateWorkspaceDto = CreateWorkspaceRequestDto;
export type UpdateWorkspaceDto = UpdateWorkspaceRequestDto;
