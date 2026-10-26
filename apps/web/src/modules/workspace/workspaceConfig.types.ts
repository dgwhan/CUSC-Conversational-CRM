export type BusinessDomain =
  | 'EDUCATION'
  | 'REAL_ESTATE'
  | 'BEAUTY_SPA'
  | 'B2B_SAAS'
  | 'RETAIL'
  | 'CUSTOM';

export interface PipelineStageConfig {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  bgColor: string;
  borderColor: string;
  order: number;
  isWon?: boolean;
  isLost?: boolean;
  isSystem?: boolean;
}

export interface ProductItemConfig {
  id: string;
  name: string;
  code?: string;
  category: string;
  defaultPrice: number;
  description?: string;
  isActive: boolean;
}

export interface WorkspaceTerminology {
  entityName: string; // "Thí sinh / Học viên", "Khách hàng", "Khách mua BĐS"
  pipelineName: string; // "Phễu Tuyển Sinh PolarisX", "Phễu Bán Hàng"
  productLabel: string; // "Khóa học quan tâm", "Sản phẩm / Dịch vụ"
  valueLabel: string; // "Học phí dự kiến (VNĐ)", "Giá trị giao dịch"
}

export interface LeadQualificationCriteria {
  id: string;
  name: string;
  type: 'TEXT' | 'SELECT' | 'NUMBER' | 'BOOLEAN';
  options?: string[];
  isRequired: boolean;
}

export interface WorkspaceConfig {
  workspaceId: string;
  workspaceName: string;
  domain: BusinessDomain;
  terminology: WorkspaceTerminology;
  pipelineStages: PipelineStageConfig[];
  productCatalog: ProductItemConfig[];
  criteria: LeadQualificationCriteria[];
}
