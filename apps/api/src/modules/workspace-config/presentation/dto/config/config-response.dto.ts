import type {
  WorkspaceConfig,
  BusinessDomain,
  WorkspaceTerminology,
} from '../../../../../contracts/workspace-config.js';

export type WorkspaceConfigResponseDto = WorkspaceConfig;

export interface PresetItemResponseDto {
  key: string;
  name: string;
  domain: BusinessDomain;
  terminology: WorkspaceTerminology;
  stagesCount: number;
  sampleStages: string[];
  productsCount: number;
  sampleProducts: string[];
}

export type PresetListResponseDto = PresetItemResponseDto[];
