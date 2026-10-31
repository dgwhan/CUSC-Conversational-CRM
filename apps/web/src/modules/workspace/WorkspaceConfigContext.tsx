import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  WorkspaceConfig,
  BusinessDomain,
  WorkspaceConfigContextType,
} from './workspaceConfig.types.js';
import { CLIENT_INDUSTRY_PRESETS } from './workspacePresets.js';
import { notify } from '../../components/feedback/toastEmitter.js';
import { useUserRole } from '../auth/UserRoleContext.js';
import {
  useWorkspaceCatalog,
  useWorkspaceStaffManagement,
  useWorkspaceManager,
} from './hooks/index.js';

// Re-export types để toàn bộ app không bị gãy import
export type {
  WorkspaceItem,
  ManagedStaffItem,
  WorkspaceConfigContextType,
  WorkspaceConfig,
  BusinessDomain,
  PipelineStageConfig,
  ProductItemConfig,
  LeadQualificationCriteria,
} from './workspaceConfig.types.js';

const STORAGE_KEY = 'polarisx_crm_workspace_config_v1';

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
  const { isOwner, staffId, staffName, ownerId, isAuthenticated } = useUserRole();
  const [isLoading, setIsLoading] = useState(false);

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

  const saveConfig = (newConfig: WorkspaceConfig) => {
    setConfig(newConfig);
    try {
      if (newConfig.workspaceId) {
        localStorage.setItem(`${STORAGE_KEY}_ws_${newConfig.workspaceId}`, JSON.stringify(newConfig));
      }
      const ownerStorageKey = effectiveOwnerId ? `${STORAGE_KEY}_${effectiveOwnerId}` : STORAGE_KEY;
      localStorage.setItem(ownerStorageKey, JSON.stringify(newConfig));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  };

  // Đồng bộ cấu hình từ Backend API theo workspaceId
  const syncFromBackend = useCallback(async (targetWsId?: string) => {
    const wsToFetch = targetWsId || config.workspaceId || '';
    if (!wsToFetch) return;

    try {
      const res = await fetch(`/api/workspaces/${wsToFetch}/config`, {
        headers: {
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-workspace-id': wsToFetch,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.pipelineStages?.length >= 2) {
          saveConfig(data);
        }
      }
    } catch (err) {
      console.warn('Could not sync workspace config from backend:', err);
    }
  }, [effectiveOwnerId, staffId, config.workspaceId]);

  // Hook 1: Quản lý Multi-Workspace & Switcher
  const workspaceManager = useWorkspaceManager({
    staffId,
    staffName,
    effectiveOwnerId,
    isAuthenticated,
    isOwner,
    syncFromBackend,
    fetchStaffList: async (wsId) => staffManager.fetchStaffList(wsId),
    setConfig,
    setIsLoading,
  });

  // Hook 2: Quản lý Nhân sự theo Workspace
  const staffManager = useWorkspaceStaffManagement({
    effectiveOwnerId,
    staffId,
    isCurrentWorkspaceOwner: workspaceManager.isCurrentWorkspaceOwner,
    activeWorkspaceId: workspaceManager.activeWorkspaceId,
    configWorkspaceId: config.workspaceId,
    onStaffChange: async () => {
      await workspaceManager.fetchMyWorkspaces();
    },
  });

  // Cập nhật cấu hình lên backend
  const updateConfig = async (patch: Partial<WorkspaceConfig>) => {
    if (!workspaceManager.isCurrentWorkspaceOwner) {
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
          'x-workspace-id': workspaceManager.activeWorkspaceId || config.workspaceId || '',
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

  // Áp dụng Preset mẫu theo ngành
  const applyPreset = async (domain: BusinessDomain, customName?: string) => {
    const preset = CLIENT_INDUSTRY_PRESETS[domain] || CLIENT_INDUSTRY_PRESETS.EDUCATION;
    const newConfig: WorkspaceConfig = {
      workspaceId: workspaceManager.activeWorkspaceId || config.workspaceId || 'ws-default-001',
      workspaceName: customName || preset.workspaceName,
      domain,
      terminology: { ...preset.terminology },
      pipelineStages: preset.pipelineStages.map((s) => ({ ...s })),
      productCatalog: preset.productCatalog.map((p) => ({ ...p })),
      criteria: preset.criteria.map((c) => ({ ...c })),
    };

    await updateConfig(newConfig);
    notify.success(`Đã áp dụng mẫu thiết lập cho ngành: ${preset.workspaceName}!`, 'Áp Dụng Mẫu Ngành Nghề');
  };

  // Hook 3: Quản lý Phễu, Sản phẩm và Tiêu chí đánh giá
  const catalog = useWorkspaceCatalog({
    config,
    updateConfig,
  });

  const resetToDefault = () => {
    if (!workspaceManager.isCurrentWorkspaceOwner) return;
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
        resetToDefault,
        // Catalog: Stages, Products, Criteria
        ...catalog,
        // Staff Management
        staffMembers: staffManager.staffMembers,
        fetchStaffList: staffManager.fetchStaffList,
        createStaffMember: staffManager.createStaffMember,
        updateStaffMember: staffManager.updateStaffMember,
        toggleLockStaffMember: staffManager.toggleLockStaffMember,
        deleteStaffMember: staffManager.deleteStaffMember,
        // Multi-Workspace & Switcher
        myWorkspaces: workspaceManager.myWorkspaces,
        activeWorkspaceId: workspaceManager.activeWorkspaceId,
        activeWorkspace: workspaceManager.activeWorkspace,
        isCurrentWorkspaceOwner: workspaceManager.isCurrentWorkspaceOwner,
        switchWorkspace: workspaceManager.switchWorkspace,
        fetchMyWorkspaces: workspaceManager.fetchMyWorkspaces,
        createWorkspace: workspaceManager.createWorkspace,
        updateWorkspaceInfo: workspaceManager.updateWorkspaceInfo,
        deleteWorkspace: workspaceManager.deleteWorkspace,
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
