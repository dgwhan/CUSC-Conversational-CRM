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
import { apiClient } from '../../lib/api-client.js';

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'STAFF';
  isOwner: boolean;
  domain: string;
  ownerName?: string;
  createdAt?: string;
}

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
  // Quản lý nhân sự Staff theo workspace
  staffMembers: ManagedStaffItem[];
  fetchStaffList: (targetWsId?: string) => Promise<ManagedStaffItem[]>;
  createStaffMember: (data: { email: string; fullName: string; password?: string; role?: 'STAFF' | 'OWNER' }) => Promise<void>;
  updateStaffMember: (staffId: string, data: { fullName?: string; password?: string; role?: 'STAFF' | 'OWNER' }) => Promise<void>;
  toggleLockStaffMember: (staffId: string, lock: boolean) => Promise<void>;
  deleteStaffMember: (staffId: string) => Promise<void>;
  resetToDefault: () => void;
  // Multi-Workspace & Switcher
  myWorkspaces: WorkspaceItem[];
  activeWorkspaceId: string;
  activeWorkspace: WorkspaceItem | null;
  isCurrentWorkspaceOwner: boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  fetchMyWorkspaces: () => Promise<WorkspaceItem[]>;
}

const STORAGE_KEY = 'polarisx_crm_workspace_config_v1';
const ACTIVE_WORKSPACE_KEY = 'polarisx_crm_active_workspace_id';

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
  const [myWorkspaces, setMyWorkspaces] = useState<WorkspaceItem[]>([]);

  // Lấy workspace ID đang active từ localStorage hoặc khởi tạo
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(ACTIVE_WORKSPACE_KEY) || '';
    }
    return '';
  });

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

  // Tìm workspace hiện tại trong danh sách
  const activeWorkspace = myWorkspaces.find((w) => w.id === activeWorkspaceId) || null;
  // Quyền OWNER trong workspace hiện tại (nếu là workspace riêng: OWNER, nếu là workspace được mời: role của membership)
  const isCurrentWorkspaceOwner = activeWorkspace ? activeWorkspace.isOwner : isOwner;

  // Lấy danh sách Workspaces của user từ Backend
  const fetchMyWorkspaces = useCallback(async (): Promise<WorkspaceItem[]> => {
    if (!isAuthenticated) return [];
    try {
      const list = await apiClient.getMyWorkspaces(staffId, effectiveOwnerId);
      if (Array.isArray(list) && list.length > 0) {
        setMyWorkspaces(list);

        // Nếu chưa chọn active workspace hoặc workspace hiện tại không nằm trong danh sách, chọn cái đầu tiên
        const currentActive = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
        const match = list.find((w) => w.id === currentActive);
        const selectedId = match ? match.id : list[0].id;

        setActiveWorkspaceId(selectedId);
        apiClient.setActiveWorkspaceId(selectedId);
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, selectedId);
        return list;
      }
    } catch (err) {
      console.warn('Could not fetch workspaces:', err);
    }
    return [];
  }, [isAuthenticated, staffId, effectiveOwnerId]);

  useEffect(() => {
    fetchMyWorkspaces();
  }, [fetchMyWorkspaces]);

  // Đồng bộ cấu hình từ Backend API theo workspaceId
  const syncFromBackend = useCallback(async (targetWsId?: string) => {
    const wsToFetch = targetWsId || activeWorkspaceId || config.workspaceId || '';
    try {
      const res = await fetch('/api/workspaces/current/config', {
        headers: {
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': isCurrentWorkspaceOwner ? 'OWNER' : 'STAFF',
          'x-workspace-id': wsToFetch,
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
  }, [effectiveOwnerId, staffId, isCurrentWorkspaceOwner, activeWorkspaceId, config.workspaceId]);

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
    if (!isCurrentWorkspaceOwner) {
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
          'x-workspace-id': activeWorkspaceId || config.workspaceId || '',
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
    if (!isCurrentWorkspaceOwner) {
      notify.warning('Chỉ Chủ doanh nghiệp (Owner/Admin) mới có quyền đổi mẫu ngành nghề.', 'Bảo Mật RBAC');
      return;
    }

    const preset = CLIENT_INDUSTRY_PRESETS[domain];
    if (!preset) return;

    setIsLoading(true);
    const newConfig: WorkspaceConfig = {
      workspaceId: activeWorkspaceId || config.workspaceId,
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
          'x-workspace-id': activeWorkspaceId || config.workspaceId || '',
        },
        body: JSON.stringify({ presetKey: domain, workspaceName: customName }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi máy chủ (${res.status})`);
      }

      const remoteConfig: WorkspaceConfig = await res.json();
      if (remoteConfig && remoteConfig.pipelineStages?.length >= 2) {
        saveConfig(remoteConfig);
      }
      notify.success(`Đã áp dụng mẫu [${preset.workspaceName}] cho hệ thống thành công!`);
    } catch (err) {
      console.error('Apply preset failed:', err);
      notify.info(`Đã áp dụng mẫu cục bộ (${(err as Error).message}).`);
    } finally {
      setIsLoading(false);
    }
  };

  const addStage = async (stage: Omit<PipelineStageConfig, 'id' | 'order'>) => {
    const newId = `stage_${Date.now()}`;
    const newOrder = config.pipelineStages.length;
    const newStage: PipelineStageConfig = {
      ...stage,
      id: newId,
      order: newOrder,
    };
    const updatedStages = [...config.pipelineStages, newStage];
    await updateConfig({ pipelineStages: updatedStages });
  };

  const updateStage = async (stageId: string, patch: Partial<PipelineStageConfig>) => {
    const updatedStages = config.pipelineStages.map((s) =>
      s.id === stageId ? { ...s, ...patch } : s
    );
    await updateConfig({ pipelineStages: updatedStages });
  };

  const deleteStage = async (stageId: string) => {
    if (config.pipelineStages.length <= 2) {
      notify.warning('Phễu phải có tối thiểu 2 giai đoạn.');
      return;
    }
    const updatedStages = config.pipelineStages
      .filter((s) => s.id !== stageId)
      .map((s, idx) => ({ ...s, order: idx }));
    await updateConfig({ pipelineStages: updatedStages });
  };

  const reorderStages = async (sourceIndex: number, destIndex: number) => {
    const nextStages = [...config.pipelineStages];
    const [moved] = nextStages.splice(sourceIndex, 1);
    nextStages.splice(destIndex, 0, moved);
    const reordered = nextStages.map((s, idx) => ({ ...s, order: idx }));
    await updateConfig({ pipelineStages: reordered });
  };

  const addProduct = async (product: Omit<ProductItemConfig, 'id'>) => {
    const newId = `prod_${Date.now()}`;
    const newProduct: ProductItemConfig = { ...product, id: newId };
    const updatedCatalog = [...config.productCatalog, newProduct];
    await updateConfig({ productCatalog: updatedCatalog });
  };

  const updateProduct = async (productId: string, patch: Partial<ProductItemConfig>) => {
    const updatedCatalog = config.productCatalog.map((p) =>
      p.id === productId ? { ...p, ...patch } : p
    );
    await updateConfig({ productCatalog: updatedCatalog });
  };

  const deleteProduct = async (productId: string) => {
    const updatedCatalog = config.productCatalog.filter((p) => p.id !== productId);
    await updateConfig({ productCatalog: updatedCatalog });
  };

  const addCriteria = async (criterion: Omit<LeadQualificationCriteria, 'id'>) => {
    const newId = `crit_${Date.now()}`;
    const newCrit: LeadQualificationCriteria = { ...criterion, id: newId };
    const updatedCriteria = [...config.criteria, newCrit];
    await updateConfig({ criteria: updatedCriteria });
  };

  const updateCriteria = async (criteriaId: string, patch: Partial<LeadQualificationCriteria>) => {
    const updatedCriteria = config.criteria.map((c) =>
      c.id === criteriaId ? { ...c, ...patch } : c
    );
    await updateConfig({ criteria: updatedCriteria });
  };

  const deleteCriteria = async (criteriaId: string) => {
    const updatedCriteria = config.criteria.filter((c) => c.id !== criteriaId);
    await updateConfig({ criteria: updatedCriteria });
  };

  // ==========================================
  // QUẢN LÝ NHÂN SỰ THEO WORKSPACE
  // ==========================================

  const fetchStaffList = useCallback(async (targetWsId?: string): Promise<ManagedStaffItem[]> => {
    const wsToFetch = targetWsId || activeWorkspaceId || config.workspaceId || '';
    try {
      const res = await fetch('/api/workspaces/current/staff', {
        headers: {
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': isCurrentWorkspaceOwner ? 'OWNER' : 'STAFF',
          'x-workspace-id': wsToFetch,
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
  }, [effectiveOwnerId, staffId, isCurrentWorkspaceOwner, activeWorkspaceId, config.workspaceId]);

  useEffect(() => {
    if (isCurrentWorkspaceOwner) {
      fetchStaffList();
    }
  }, [isCurrentWorkspaceOwner, fetchStaffList]);

  // Chuyển đổi nhanh giữa các Workspace (Workspace Switcher)
  const switchWorkspace = async (targetWsId: string) => {
    if (targetWsId === activeWorkspaceId) return;

    const targetWs = myWorkspaces.find((w) => w.id === targetWsId);
    setActiveWorkspaceId(targetWsId);
    apiClient.setActiveWorkspaceId(targetWsId);
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, targetWsId);

    setIsLoading(true);
    try {
      await Promise.all([
        syncFromBackend(targetWsId),
        fetchStaffList(targetWsId),
      ]);
      notify.success(
        `Đã chuyển sang không gian làm việc "${targetWs?.name || 'Workspace'}" (${targetWs?.isOwner ? 'Chủ sở hữu' : 'Thành viên'})!`,
        'Đổi Workspace'
      );
    } catch (err) {
      console.error('Switch workspace failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createStaffMember = async (data: { email: string; fullName: string; password?: string; role?: 'STAFF' | 'OWNER' }) => {
    try {
      const res = await fetch('/api/workspaces/current/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': 'OWNER',
          'x-workspace-id': activeWorkspaceId || config.workspaceId || '',
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Lỗi khi mời nhân viên');
      }

      const created = await res.json();
      setStaffMembers((prev) => [created, ...prev.filter((s) => s.id !== created.id)]);
      notify.success(`Đã thêm nhân viên "${created.fullName}" (${created.email}) vào Workspace!`);
    } catch (err) {
      notify.error((err as Error).message, 'Mời Nhân Viên Thất Bại');
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
          'x-workspace-id': activeWorkspaceId || config.workspaceId || '',
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
          'x-workspace-id': activeWorkspaceId || config.workspaceId || '',
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
          'x-workspace-id': activeWorkspaceId || config.workspaceId || '',
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Lỗi khi xóa nhân viên');
      }

      setStaffMembers((prev) => prev.filter((s) => s.id !== targetId));
      notify.success('Đã loại nhân viên khỏi Workspace!');
    } catch (err) {
      notify.error((err as Error).message, 'Xóa Thất Bại');
      throw err;
    }
  };

  /**
   * Khôi phục về mặc định PolarisX
   */
  const resetToDefault = () => {
    if (!isCurrentWorkspaceOwner) return;
    saveConfig(initialDefaultConfig);
    notify.success('Đã khôi phục cấu hình mặc định CRM.');
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
        myWorkspaces,
        activeWorkspaceId,
        activeWorkspace,
        isCurrentWorkspaceOwner,
        switchWorkspace,
        fetchMyWorkspaces,
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
