import type { WorkspaceConfig, BusinessDomain } from '../../workspaceConfig.types.js';

export interface ConfigProfileItem {
  id: string;
  name: string;
  domain: BusinessDomain | string;
  config: WorkspaceConfig;
  createdAt?: string;
  updatedAt?: string;
}

