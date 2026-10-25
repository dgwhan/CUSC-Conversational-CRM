import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  WorkspaceConfig,
  BusinessDomain,
  PipelineStageConfig,
  ProductItemConfig,
} from './workspaceConfig.types.js';
import { CLIENT_INDUSTRY_PRESETS } from './workspacePresets.js';
import { notify } from '../../components/feedback/toastEmitter.js';
import { useUserRole } from '../auth/UserRoleContext.js';

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
  const { isOwner, isAuthenticated } = useUserRole();
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<WorkspaceConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
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

  // Đồng bộ cấu hình từ Backend API
  const syncFromBackend = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces/current/config');
      if (res.ok) {
        const remoteConfig: WorkspaceConfig = await res.json();
        if (remoteConfig && remoteConfig.pipelineStages?.length >= 2) {
          setConfig(remoteConfig);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteConfig));
        }
      }
    } catch {
      // Backend có thể chưa chạy, dùng local cache
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    syncFromBackend();
  }, [syncFromBackend, isAuthenticated]);

  // Lưu state ra localStorage mỗi khi config thay đổi
  const saveConfig = (newConfig: WorkspaceConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  };

  /**
   * Cập nhật toàn bộ hoặc một phần cấu hình
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
      await fetch('/api/workspaces/current/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'OWNER',
        },
        body: JSON.stringify(patch),
      });
      notify.success('Đã lưu cấu hình Workspace thành công!');
    } catch {
      notify.info('Đã lưu cấu hình vào bộ nhớ máy tính (Offline Mode).');
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
      await fetch('/api/workspaces/current/config/apply-preset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'OWNER',
        },
        body: JSON.stringify({ presetKey: domain, workspaceName: customName }),
      });
      notify.success(`Đã áp dụng mẫu "${preset.terminology.pipelineName}" cho Workspace!`);
    } catch {
      notify.success(`Đã chuyển đổi sang mô hình "${preset.terminology.pipelineName}" (Offline).`);
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
    notify.success(`Đã thêm giai đoạn "${stage.name}" vào phễu!`);
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
    // Cập nhật lại order
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

    // Cập nhật order
    stages.forEach((s, idx) => {
      s.order = idx + 1;
    });

    await updateConfig({ pipelineStages: stages });
  };

  /**
   * Thêm sản phẩm / khóa học mới
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
   * Cập nhật sản phẩm
   */
  const updateProduct = async (productId: string, patch: Partial<ProductItemConfig>) => {
    const newCatalog = config.productCatalog.map((p) => (p.id === productId ? { ...p, ...patch } : p));
    await updateConfig({ productCatalog: newCatalog });
  };

  /**
   * Xóa sản phẩm
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
