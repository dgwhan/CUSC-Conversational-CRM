import type {
  WorkspaceConfig,
  BusinessDomain,
  PipelineStageConfig,
  ProductItemConfig,
  LeadQualificationCriteria,
} from '../../../../../contracts/workspace-config.js';

export type UpdateWorkspaceConfigRequestDto = Partial<WorkspaceConfig>;

export interface ApplyPresetRequestDto {
  presetKey: BusinessDomain;
  workspaceName?: string;
}

export type AddPipelineStageRequestDto = Omit<PipelineStageConfig, 'id' | 'order'>;

export type AddProductItemRequestDto = Omit<ProductItemConfig, 'id'>;

export type AddCriteriaRequestDto = Omit<LeadQualificationCriteria, 'id'>;

// Aliases for compatibility
export type UpdateWorkspaceConfigDto = UpdateWorkspaceConfigRequestDto;
export type ApplyPresetDto = ApplyPresetRequestDto;
