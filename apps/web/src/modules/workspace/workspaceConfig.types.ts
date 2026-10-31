import { USER_ROLES } from '../auth/userRole.types.js';

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
  pipelineName: string; // "Phễu Tuyển Sinh CUSC", "Phễu Bán Hàng"
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

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  role: typeof USER_ROLES.OWNER | typeof USER_ROLES.STAFF;
  isOwner: boolean;
  domain: string;
  ownerId?: string;
  ownerName?: string;
  createdAt?: string;
}

export interface ManagedStaffItem {
  id: string;
  email: string;
  phoneNumber?: string | null;
  fullName: string;
  role: string;
  status: 'ACTIVE' | 'LOCKED';
  ownerId: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceConfigContextType {
  config: WorkspaceConfig;
  isLoading: boolean;
  applyPreset: (domain: BusinessDomain, customName?: string) => Promise<void>;
  updateConfig: (patch: Partial<WorkspaceConfig>) => Promise<void>;
  addStage: (stage: Omit<PipelineStageConfig, 'id' | 'order'>) => Promise<void>;
  updateStage: (stageId: string, patch: Partial<PipelineStageConfig>) => Promise<void>;
  deleteStage: (stageId: string) => Promise<void>;
  reorderStages: (sourceIndex: number, destIndex: number) => Promise<void>;
  addProduct: (product: Omit<ProductItemConfig, 'id'>) => Promise<void>;
  updateProduct: (productId: string, patch: Partial<ProductItemConfig>) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  addCriteria: (criteria: Omit<LeadQualificationCriteria, 'id'>) => Promise<void>;
  updateCriteria: (criteriaId: string, patch: Partial<LeadQualificationCriteria>) => Promise<void>;
  deleteCriteria: (criteriaId: string) => Promise<void>;
  // Quản lý nhân sự Staff theo workspace
  staffMembers: ManagedStaffItem[];
  fetchStaffList: (targetWsId?: string) => Promise<ManagedStaffItem[]>;
  createStaffMember: (data: { email: string; fullName: string; phoneNumber?: string; password?: string; role?: typeof USER_ROLES.STAFF | typeof USER_ROLES.OWNER }, targetWsId?: string) => Promise<void>;
  updateStaffMember: (staffId: string, data: { fullName?: string; phoneNumber?: string; password?: string; role?: typeof USER_ROLES.STAFF | typeof USER_ROLES.OWNER }, targetWsId?: string) => Promise<void>;
  toggleLockStaffMember: (staffId: string, lock: boolean) => Promise<void>;
  deleteStaffMember: (staffId: string, targetWsId?: string) => Promise<void>;
  resetToDefault: () => void;
  // Multi-Workspace & Switcher
  myWorkspaces: WorkspaceItem[];
  activeWorkspaceId: string;
  activeWorkspace: WorkspaceItem | null;
  isCurrentWorkspaceOwner: boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  fetchMyWorkspaces: () => Promise<WorkspaceItem[]>;
  createWorkspace: (data: {
    name: string;
    domain?: BusinessDomain | string;
  }) => Promise<WorkspaceItem | null>;
  updateWorkspaceInfo: (
    workspaceId: string,
    data: { name?: string; domain?: string },
  ) => Promise<WorkspaceItem>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
}
