import { USER_ROLES } from '../auth/userRole.types.js';

export type BusinessDomain =
  | 'EDUCATION'
  | 'REAL_ESTATE'
  | 'BEAUTY_SPA'
  | 'B2B_SAAS'
  | 'RETAIL'
  | 'CUSTOM'
  | (string & {});

export const DOMAIN_OPTIONS: { value: string; label: string }[] = [
  { value: 'EDUCATION', label: 'Giáo dục & Tuyển sinh' },
  { value: 'REAL_ESTATE', label: 'Bất động sản & Dự án' },
  { value: 'BEAUTY_SPA', label: 'Thẩm mỹ viện & Spa' },
  { value: 'B2B_SAAS', label: 'B2B SaaS & Phần mềm' },
  { value: 'RETAIL', label: 'Bán lẻ & Thương mại' },
  { value: 'CUSTOM', label: '+ Thêm loại mô hình khác (Tự nhập)...' },
];

export const getDomainLabel = (domain?: string): string => {
  if (!domain) return 'Mô hình tùy chỉnh';
  const found = DOMAIN_OPTIONS.find((opt) => opt.value === domain);
  if (found && found.value !== 'CUSTOM') return found.label;
  if (domain === 'CUSTOM') return 'Mô hình tùy chỉnh';
  return domain;
};

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

export interface DayWorkingSchedule {
  dayOfWeek: number; // 1: T2, 2: T3, 3: T4, 4: T5, 5: T6, 6: T7, 0/7: CN
  dayName: string;
  isOpen: boolean;
  openTime: string; // "07:00"
  closeTime: string; // "17:00"
}

export interface WorkingHoursConfig {
  enabled: boolean;
  timezone: string;
  schedules: DayWorkingSchedule[];
  autoReplyMessage: string;
  outOfOfficeTag: string;
  cooldownMinutes: number;
}

export function getDefaultWorkingHoursConfig(): WorkingHoursConfig {
  return {
    enabled: true,
    timezone: 'Asia/Ho_Chi_Minh',
    schedules: [
      { dayOfWeek: 1, dayName: 'Thứ Hai', isOpen: true, openTime: '07:00', closeTime: '17:00' },
      { dayOfWeek: 2, dayName: 'Thứ Ba', isOpen: true, openTime: '07:00', closeTime: '17:00' },
      { dayOfWeek: 3, dayName: 'Thứ Tư', isOpen: true, openTime: '07:00', closeTime: '17:00' },
      { dayOfWeek: 4, dayName: 'Thứ Năm', isOpen: true, openTime: '07:00', closeTime: '17:00' },
      { dayOfWeek: 5, dayName: 'Thứ Sáu', isOpen: true, openTime: '07:00', closeTime: '17:00' },
      { dayOfWeek: 6, dayName: 'Thứ Bảy', isOpen: false, openTime: '07:00', closeTime: '12:00' },
      { dayOfWeek: 7, dayName: 'Chủ Nhật', isOpen: false, openTime: '07:00', closeTime: '12:00' },
    ],
    autoReplyMessage:
      'Cảm ơn bạn đã liên hệ! Hiện tại đang ngoài khung giờ làm việc của chúng tôi (Thứ 2 - Thứ 6: 07:00 - 17:00). Chúng tôi đã ghi nhận tin nhắn và tư vấn viên sẽ liên hệ lại với bạn ngay vào đầu giờ làm việc tiếp theo. Chúc bạn một ngày tốt lành!',
    outOfOfficeTag: 'HẸN TƯ VẤN SÁNG HÔM SAU',
    cooldownMinutes: 60,
  };
}

export interface WorkspaceConfig {
  workspaceId: string;
  workspaceName: string;
  domain: BusinessDomain;
  terminology: WorkspaceTerminology;
  pipelineStages: PipelineStageConfig[];
  productCatalog: ProductItemConfig[];
  criteria: LeadQualificationCriteria[];
  unresponsiveAlertMinutes?: number;
  workingHours?: WorkingHoursConfig;
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
