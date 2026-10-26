import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  WorkspaceConfig,
  BusinessDomain,
  PipelineStageConfig,
  ProductItemConfig,
  LeadQualificationCriteria,
} from './workspaceConfig.types.js';
import { CLIENT_INDUSTRY_PRESETS } from './workspacePresets.js';
import { notify } from '../../components/feedback/toastEmitter.js';
import { useUserRole } from '../auth/UserRoleContext.js';

export interface ManagedStaffItem {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: 'ACTIVE' | 'LOCKED';
  ownerId: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceConfigContextType {
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
  // Quản lý nhân sự Staff theo ownerId
  staffMembers: ManagedStaffItem[];
  fetchStaffList: () => Promise<ManagedStaffItem[]>;
  createStaffMember: (data: { email: string; fullName: string; password?: string; role?: 'STAFF' | 'OWNER' }) => Promise<void>;
  updateStaffMember: (staffId: string, data: { fullName?: string; password?: string; role?: 'STAFF' | 'OWNER' }) => Promise<void>;
  toggleLockStaffMember: (staffId: string, lock: boolean) => Promise<void>;
  deleteStaffMember: (staffId: string) => Promise<void>;
  resetToDefault: () => void;
}

const STORAGE_KEY = 'cusc_crm_workspace_config_v1';

const defaultEducationPreset = CLIENT_INDUSTRY_PRESETS.EDUCATION;
const initialDefaultConfig: WorkspaceConfig = {
  workspaceId: 'ws-default-001',
  workspaceName: defaultEducationPreset.workspaceName,
  domain: defaultEducationPreset.domain,
  terminology: { ...defaultEducationPreset.terminology },
  pipelineStages: defaultEducationPreset.pipelineStages.map((s) => ({ ...s })),
  productCatalog: defaultEducationPreset.productCatalog.map((p) => ({ ...p })),
  criteria: defaultEducationPreset.criteria.map((c) => ({ ...c })),
};

const WorkspaceConfigContext = createContext<WorkspaceConfigContextType | undefined>(undefined);

export const WorkspaceConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isOwner, staffId, ownerId, isAuthenticated } = useUserRole();
  const [isLoading, setIsLoading] = useState(false);
  const [staffMembers, setStaffMembers] = useState<ManagedStaffItem[]>([]);

  const effectiveOwnerId = ownerId || (isOwner ? staffId : '');

  const [config, setConfig] = useState<WorkspaceConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const ownerStorageKey = effectiveOwnerId ? `${STORAGE_KEY}_${effectiveOwnerId}` : STORAGE_KEY;
        const stored = localStorage.getItem(ownerStorageKey) || localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.pipelineStages && parsed.pipelineStages.length >= 2) {
            return parsed;
          }
        }
      } catch (err) {
        console.warn('Could not read cached workspace config:', err);
      }
    }
    return initialDefaultConfig;
  });

  // Đồng bộ cấu hình từ Backend API theo ownerId
  const syncFromBackend = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces/current/config', {
        headers: {
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': isOwner ? 'OWNER' : 'STAFF',
          'x-workspace-id': config.workspaceId || '',
        },
      });
      if (res.ok) {
        const remoteConfig: WorkspaceConfig = await res.json();
        if (remoteConfig && remoteConfig.pipelineStages?.length >= 2) {
          setConfig(remoteConfig);
          const ownerStorageKey = effectiveOwnerId ? `${STORAGE_KEY}_${effectiveOwnerId}` : STORAGE_KEY;
          localStorage.setItem(ownerStorageKey, JSON.stringify(remoteConfig));
        }
      }
    } catch {
      // Backend có thể chưa chạy, dùng local cache
    }
  }, [effectiveOwnerId, staffId, isOwner, config.workspaceId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    syncFromBackend();
  }, [syncFromBackend, isAuthenticated]);

  // Lưu state ra localStorage theo ownerId mỗi khi config thay đổi
  const saveConfig = (newConfig: WorkspaceConfig) => {
    setConfig(newConfig);
    try {
      const ownerStorageKey = effectiveOwnerId ? `${STORAGE_KEY}_${effectiveOwnerId}` : STORAGE_KEY;
      localStorage.setItem(ownerStorageKey, JSON.stringify(newConfig));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  };

  /**
   * Cập nhật toàn bộ hoặc một phần cấu hình và lưu DB theo ownerId
   */
  const updateConfig = async (patch: Partial<WorkspaceConfig>) => {
    if (!isOwner) {
      notify.warning('Chỉ Chủ doanh nghiệp (Owner/Admin) mới có quyền chỉnh sửa cấu hình Workspace.', 'Bảo Mật RBAC');
      return;
    }

    setIsLoading(true);
    const updated: WorkspaceConfig = {
      ...config,
      ...patch,
      terminology: {
        ...config.terminology,
        ...(patch.terminology || {}),
      },
    };

    saveConfig(updated);

    try {
      const res = await fetch('/api/workspaces/current/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'OWNER',
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-workspace-id': config.workspaceId || '',
        },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi máy chủ (${res.status})`);
      }

      const remoteConfig: WorkspaceConfig = await res.json();
      if (remoteConfig && remoteConfig.pipelineStages?.length >= 2) {
        saveConfig(remoteConfig);
      }
      notify.success('Đã lưu cấu hình Workspace thành công vào cơ sở dữ liệu!');
    } catch (err) {
      console.error('Update config failed:', err);
      notify.info(`Đã lưu cấu hình cục bộ (${(err as Error).message}).`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 1-Click áp dụng mẫu ngành nghề
   */
  const applyPreset = async (domain: BusinessDomain, customName?: string) => {
    if (!isOwner) {
      notify.warning('Chỉ Chủ doanh nghiệp (Owner/Admin) mới có quyền đổi mẫu ngành nghề.', 'Bảo Mật RBAC');
      return;
    }

    const preset = CLIENT_INDUSTRY_PRESETS[domain];
    if (!preset) return;

    setIsLoading(true);
    const newConfig: WorkspaceConfig = {
      workspaceId: config.workspaceId,
      workspaceName: customName || preset.workspaceName,
      domain: preset.domain,
      terminology: { ...preset.terminology },
      pipelineStages: preset.pipelineStages.map((s) => ({ ...s })),
      productCatalog: preset.productCatalog.map((p) => ({ ...p })),
      criteria: preset.criteria.map((c) => ({ ...c })),
    };

    saveConfig(newConfig);

    try {
      const res = await fetch('/api/workspaces/current/config/apply-preset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'OWNER',
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
        },
        body: JSON.stringify({ presetKey: domain, workspaceName: customName }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi máy chủ (${res.status})`);
      }

      const remoteConfig: WorkspaceConfig = await res.json();
      if (remoteConfig) saveConfig(remoteConfig);
      notify.success(`Đã áp dụng mẫu "${preset.terminology.pipelineName}" vào Database!`);
    } catch (err) {
      notify.info(`Đã chuyển đổi sang mô hình "${preset.terminology.pipelineName}" (${(err as Error).message}).`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Thêm giai đoạn mới vào phễu
   */
  const addStage = async (stage: Omit<PipelineStageConfig, 'id' | 'order'>) => {
    const newStage: PipelineStageConfig = {
      ...stage,
      id: `STAGE_${Date.now()}`,
      order: config.pipelineStages.length + 1,
    };

    const newStages = [...config.pipelineStages, newStage];
    await updateConfig({ pipelineStages: newStages });
  };

  /**
   * Cập nhật 1 giai đoạn
   */
  const updateStage = async (stageId: string, patch: Partial<PipelineStageConfig>) => {
    const newStages = config.pipelineStages.map((s) => (s.id === stageId ? { ...s, ...patch } : s));
    await updateConfig({ pipelineStages: newStages });
  };

  /**
   * Xóa giai đoạn
   */
  const deleteStage = async (stageId: string) => {
    if (config.pipelineStages.length <= 2) {
      notify.warning('Phễu phải có tối thiểu 2 giai đoạn (bắt đầu và kết thúc). Không thể xóa thêm.');
      return;
    }

    const stageToDelete = config.pipelineStages.find((s) => s.id === stageId);
    const newStages = config.pipelineStages.filter((s) => s.id !== stageId);
    newStages.forEach((s, idx) => {
      s.order = idx + 1;
    });

    await updateConfig({ pipelineStages: newStages });
    notify.info(`Đã xóa giai đoạn "${stageToDelete?.name || stageId}" khỏi phễu.`);
  };

  /**
   * Đổi thứ tự giai đoạn
   */
  const reorderStages = async (sourceIndex: number, destIndex: number) => {
    if (sourceIndex === destIndex) return;
    const stages = [...config.pipelineStages];
    const [moved] = stages.splice(sourceIndex, 1);
    stages.splice(destIndex, 0, moved);

    stages.forEach((s, idx) => {
      s.order = idx + 1;
    });

    await updateConfig({ pipelineStages: stages });
  };

  /**
   * Thêm sản phẩm / khóa học / ngành đào tạo mới
   */
  const addProduct = async (product: Omit<ProductItemConfig, 'id'>) => {
    const newProduct: ProductItemConfig = {
      ...product,
      id: `PROD_${Date.now()}`,
    };

    const newCatalog = [...config.productCatalog, newProduct];
    await updateConfig({ productCatalog: newCatalog });
    notify.success(`Đã thêm "${product.name}" vào danh mục ${config.terminology.productLabel}!`);
  };

  /**
   * Cập nhật sản phẩm / khóa học
   */
  const updateProduct = async (productId: string, patch: Partial<ProductItemConfig>) => {
    const newCatalog = config.productCatalog.map((p) => (p.id === productId ? { ...p, ...patch } : p));
    await updateConfig({ productCatalog: newCatalog });
  };

  /**
   * Xóa sản phẩm / khóa học
   */
  const deleteProduct = async (productId: string) => {
    if (config.productCatalog.length <= 1) {
      notify.warning(`Danh mục ${config.terminology.productLabel} phải có ít nhất 1 mục.`);
      return;
    }

    const newCatalog = config.productCatalog.filter((p) => p.id !== productId);
    await updateConfig({ productCatalog: newCatalog });
    notify.info('Đã xóa mục khỏi danh mục.');
  };

  /**
   * Thêm tiêu chí đánh giá / phân loại mới
   */
  const addCriteria = async (criteria: Omit<LeadQualificationCriteria, 'id'>) => {
    const newCrit: LeadQualificationCriteria = {
      ...criteria,
      id: `CRIT_${Date.now()}`,
    };
    const newCriteriaList = [...config.criteria, newCrit];
    await updateConfig({ criteria: newCriteriaList });
    notify.success(`Đã thêm tiêu chí "${criteria.name}" vào Workspace!`);
  };

  /**
   * Cập nhật tiêu chí
   */
  const updateCriteria = async (criteriaId: string, patch: Partial<LeadQualificationCriteria>) => {
    const newCriteriaList = config.criteria.map((c) => (c.id === criteriaId ? { ...c, ...patch } : c));
    await updateConfig({ criteria: newCriteriaList });
  };

  /**
   * Xóa tiêu chí
   */
  const deleteCriteria = async (criteriaId: string) => {
    const newCriteriaList = config.criteria.filter((c) => c.id !== criteriaId);
    await updateConfig({ criteria: newCriteriaList });
    notify.info('Đã xóa tiêu chí đánh giá.');
  };

  // ==========================================
  // QUẢN LÝ NHÂN SỰ STAFF THUỘC OWNER
  // ==========================================

  const fetchStaffList = useCallback(async (): Promise<ManagedStaffItem[]> => {
    try {
      const res = await fetch('/api/workspaces/current/staff', {
        headers: {
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': isOwner ? 'OWNER' : 'STAFF',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setStaffMembers(data);
        return data;
      }
    } catch (err) {
      console.warn('Could not fetch staff from backend:', err);
    }
    return [];
  }, [effectiveOwnerId, staffId, isOwner]);

  useEffect(() => {
    if (isOwner) {
      fetchStaffList();
    }
  }, [isOwner, fetchStaffList]);

  const createStaffMember = async (data: { email: string; fullName: string; password?: string; role?: 'STAFF' | 'OWNER' }) => {
    try {
      const res = await fetch('/api/workspaces/current/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': 'OWNER',
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Lỗi khi tạo tài khoản nhân viên');
      }

      const created = await res.json();
      setStaffMembers((prev) => [created, ...prev]);
      notify.success(`Đã tạo tài khoản cho nhân viên "${created.fullName}"!`);
    } catch (err) {
      notify.error((err as Error).message, 'Tạo Nhân Viên Thất Bại');
      throw err;
    }
  };

  const updateStaffMember = async (targetId: string, data: { fullName?: string; password?: string; role?: 'STAFF' | 'OWNER' }) => {
    try {
      const res = await fetch(`/api/workspaces/current/staff/${targetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': 'OWNER',
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Lỗi khi cập nhật tài khoản');
      }

      const updated = await res.json();
      setStaffMembers((prev) => prev.map((s) => (s.id === targetId ? updated : s)));
      notify.success(`Đã cập nhật thông tin nhân viên "${updated.fullName}"!`);
    } catch (err) {
      notify.error((err as Error).message, 'Cập Nhật Thất Bại');
      throw err;
    }
  };

  const toggleLockStaffMember = async (targetId: string, lock: boolean) => {
    try {
      const res = await fetch(`/api/workspaces/current/staff/${targetId}/lock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': 'OWNER',
        },
        body: JSON.stringify({ lock }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Lỗi khi thay đổi trạng thái khóa');
      }

      const updated = await res.json();
      setStaffMembers((prev) => prev.map((s) => (s.id === targetId ? updated : s)));
      notify.info(
        lock ? `Đã khóa tài khoản "${updated.fullName}".` : `Đã mở khóa tài khoản "${updated.fullName}".`,
        'Trạng Thái Nhân Viên'
      );
    } catch (err) {
      notify.error((err as Error).message, 'Thao Tác Thất Bại');
      throw err;
    }
  };

  const deleteStaffMember = async (targetId: string) => {
    try {
      const res = await fetch(`/api/workspaces/current/staff/${targetId}`, {
        method: 'DELETE',
        headers: {
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': 'OWNER',
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Lỗi khi xóa nhân viên');
      }

      setStaffMembers((prev) => prev.filter((s) => s.id !== targetId));
      notify.success('Đã xóa nhân viên khỏi hệ thống!');
    } catch (err) {
      notify.error((err as Error).message, 'Xóa Thất Bại');
      throw err;
    }
  };

  /**
   * Khôi phục về mặc định CUSC
   */
  const resetToDefault = () => {
    if (!isOwner) return;
    saveConfig(initialDefaultConfig);
    notify.success('Đã khôi phục cấu hình mặc định CUSC.');
  };

  return (
    <WorkspaceConfigContext.Provider
      value={{
        config,
        isLoading,
        applyPreset,
        updateConfig,
        addStage,
        updateStage,
        deleteStage,
        reorderStages,
        addProduct,
        updateProduct,
        deleteProduct,
        addCriteria,
        updateCriteria,
        deleteCriteria,
        staffMembers,
        fetchStaffList,
        createStaffMember,
        updateStaffMember,
        toggleLockStaffMember,
        deleteStaffMember,
        resetToDefault,
      }}
    >
      {children}
    </WorkspaceConfigContext.Provider>
  );
};

export const useWorkspaceConfig = () => {
  const context = useContext(WorkspaceConfigContext);
  if (!context) {
    throw new Error('useWorkspaceConfig must be used within a WorkspaceConfigProvider');
  }
  return context;
};
