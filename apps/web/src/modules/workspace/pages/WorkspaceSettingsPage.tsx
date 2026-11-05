import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit2,
  Save,
  Tag,
  Clock,
} from 'lucide-react';
import { useWorkspaceConfig } from '../WorkspaceConfigContext.js';
import { useUserRole } from '../../auth/UserRoleContext.js';
import type { PipelineStageConfig, BusinessDomain, WorkspaceConfig, WorkingHoursConfig } from '../workspaceConfig.types.js';
import { CLIENT_INDUSTRY_PRESETS } from '../workspacePresets.js';
import { notify } from '../../../components/feedback/toastEmitter.js';
import { EmptyState, Modal, Tabs, type TabItem } from '../../../components/ui/index.js';

import type { ConfigProfileItem } from '../components/settings/types.js';
import { ConfigListPage } from '../components/settings/ConfigListPage.js';
import { ConfigDetailHeader } from '../components/settings/ConfigDetailHeader.js';
import { CreateConfigModal } from '../components/settings/modals/CreateConfigModal.js';
import { EditConfigModal } from '../components/settings/modals/EditConfigModal.js';
import { DeleteConfigModal } from '../components/settings/modals/DeleteConfigModal.js';

import { WorkingHoursTab } from '../components/settings/WorkingHoursTab.js';

type SettingsTabId = 'stages' | 'catalog' | 'terminology' | 'criteria' | 'alerts' | 'workingHours';

const STORAGE_PROFILES_KEY = 'polarisx_crm_config_profiles_v1';
const STORAGE_ACTIVE_KEY = 'polarisx_crm_active_profile_id_v1';

const COLOR_SWATCHES = [
  { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', name: 'Xanh Lam' },
  { color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', name: 'Chàm Indigo' },
  { color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', name: 'Tím Violet' },
  { color: '#d97706', bg: '#fffbeb', border: '#fde68a', name: 'Hổ Phách' },
  { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', name: 'Cam Đậm' },
  { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', name: 'Xanh Mòng Két' },
  { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', name: 'Xanh Lá' },
  { color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8', name: 'Hồng Phấn' },
  { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', name: 'Xám Đá' },
];

function generateDefaultProfiles(activeConfig: WorkspaceConfig): ConfigProfileItem[] {
  return [
    {
      id: 'cfg-default-education',
      name: activeConfig.workspaceName ? `Cấu hình ${activeConfig.workspaceName}` : 'Cấu hình Giáo dục & Tuyển sinh',
      domain: activeConfig.domain || 'EDUCATION',
      config: JSON.parse(JSON.stringify(activeConfig)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cfg-preset-real-estate',
      name: 'Mẫu Cấu hình Bất động sản & Dự án',
      domain: 'REAL_ESTATE',
      config: {
        workspaceId: 'cfg-preset-real-estate',
        workspaceName: 'Mẫu Bất động sản',
        domain: 'REAL_ESTATE',
        terminology: { ...CLIENT_INDUSTRY_PRESETS.REAL_ESTATE.terminology },
        pipelineStages: CLIENT_INDUSTRY_PRESETS.REAL_ESTATE.pipelineStages.map((s) => ({ ...s })),
        productCatalog: CLIENT_INDUSTRY_PRESETS.REAL_ESTATE.productCatalog.map((p) => ({ ...p })),
        criteria: CLIENT_INDUSTRY_PRESETS.REAL_ESTATE.criteria.map((c) => ({ ...c })),
        unresponsiveAlertMinutes: 15,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cfg-preset-spa',
      name: 'Mẫu Cấu hình Thẩm mỹ viện & Spa',
      domain: 'BEAUTY_SPA',
      config: {
        workspaceId: 'cfg-preset-spa',
        workspaceName: 'Mẫu Thẩm mỹ viện & Spa',
        domain: 'BEAUTY_SPA',
        terminology: { ...CLIENT_INDUSTRY_PRESETS.BEAUTY_SPA.terminology },
        pipelineStages: CLIENT_INDUSTRY_PRESETS.BEAUTY_SPA.pipelineStages.map((s) => ({ ...s })),
        productCatalog: CLIENT_INDUSTRY_PRESETS.BEAUTY_SPA.productCatalog.map((p) => ({ ...p })),
        criteria: CLIENT_INDUSTRY_PRESETS.BEAUTY_SPA.criteria.map((c) => ({ ...c })),
        unresponsiveAlertMinutes: 15,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cfg-preset-saas',
      name: 'Mẫu Cấu hình B2B SaaS & Phần mềm',
      domain: 'B2B_SAAS',
      config: {
        workspaceId: 'cfg-preset-saas',
        workspaceName: 'Mẫu B2B SaaS',
        domain: 'B2B_SAAS',
        terminology: { ...CLIENT_INDUSTRY_PRESETS.B2B_SAAS.terminology },
        pipelineStages: CLIENT_INDUSTRY_PRESETS.B2B_SAAS.pipelineStages.map((s) => ({ ...s })),
        productCatalog: CLIENT_INDUSTRY_PRESETS.B2B_SAAS.productCatalog.map((p) => ({ ...p })),
        criteria: CLIENT_INDUSTRY_PRESETS.B2B_SAAS.criteria.map((c) => ({ ...c })),
        unresponsiveAlertMinutes: 15,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cfg-preset-retail',
      name: 'Mẫu Cấu hình Bán lẻ & Thương mại',
      domain: 'RETAIL',
      config: {
        workspaceId: 'cfg-preset-retail',
        workspaceName: 'Mẫu Bán lẻ',
        domain: 'RETAIL',
        terminology: { ...CLIENT_INDUSTRY_PRESETS.RETAIL.terminology },
        pipelineStages: CLIENT_INDUSTRY_PRESETS.RETAIL.pipelineStages.map((s) => ({ ...s })),
        productCatalog: CLIENT_INDUSTRY_PRESETS.RETAIL.productCatalog.map((p) => ({ ...p })),
        criteria: CLIENT_INDUSTRY_PRESETS.RETAIL.criteria.map((c) => ({ ...c })),
        unresponsiveAlertMinutes: 15,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

export const WorkspaceSettingsPage: React.FC = () => {
  const {
    config,
    isLoading,
    updateConfig,
  } = useWorkspaceConfig();

  const { isOwner } = useUserRole();

  // Navigation state: list vs detail
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  // Profiles list & active profile ID
  const [profiles, setProfiles] = useState<ConfigProfileItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PROFILES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return generateDefaultProfiles(config);
  });

  const [activeProfileId, setActiveProfileId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ACTIVE_KEY);
      if (saved) return saved;
    } catch {
      // Fallback
    }
    return 'cfg-default-education';
  });

  const [selectedProfileId, setSelectedProfileId] = useState<string>('cfg-default-education');

  // Active profile object for detail view
  const currentProfile = profiles.find((p) => p.id === selectedProfileId) || profiles[0] || {
    id: 'cfg-fallback',
    name: 'Cấu hình tiêu chuẩn',
    domain: 'EDUCATION',
    config,
  };

  // Save profiles to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(profiles));
    } catch (e) {
      console.warn('Failed to persist config profiles to localStorage:', e);
    }
  }, [profiles]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ACTIVE_KEY, activeProfileId);
    } catch (e) {
      console.warn('Failed to persist active config profile ID:', e);
    }
  }, [activeProfileId]);

  // Modals for Config Profile Management
  const [isCreateConfigModalOpen, setIsCreateConfigModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ConfigProfileItem | null>(null);
  const [deletingProfile, setDeletingProfile] = useState<ConfigProfileItem | null>(null);

  // Tab state within detail view
  const [activeTab, setActiveTab] = useState<SettingsTabId>('stages');

  // Modals for Tab Details
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [isEditStageModalOpen, setIsEditStageModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isAddCriteriaModalOpen, setIsAddCriteriaModalOpen] = useState(false);

  // Form states for Detail Tabs
  const [unresponsiveAlertMinutes, setUnresponsiveAlertMinutes] = useState<number>(
    currentProfile.config.unresponsiveAlertMinutes ?? 15
  );
  const [isAlertEnabled, setIsAlertEnabled] = useState<boolean>(
    (currentProfile.config.unresponsiveAlertMinutes ?? 15) > 0
  );

  const [newCritName, setNewCritName] = useState('');
  const [newCritType, setNewCritType] = useState<'TEXT' | 'SELECT' | 'NUMBER' | 'BOOLEAN'>('TEXT');
  const [newCritOptions, setNewCritOptions] = useState('');
  const [newCritRequired, setNewCritRequired] = useState(false);

  const [newStageName, setNewStageName] = useState('');
  const [newStageSubtitle, setNewStageSubtitle] = useState('');
  const [newStageColor, setNewStageColor] = useState(COLOR_SWATCHES[0]);
  const [newStageIsWon, setNewStageIsWon] = useState(false);
  const [newStageIsLost, setNewStageIsLost] = useState(false);

  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState('');
  const [editStageSubtitle, setEditStageSubtitle] = useState('');
  const [editStageColor, setEditStageColor] = useState(COLOR_SWATCHES[0]);

  const [newProdName, setNewProdName] = useState('');
  const [newProdCode, setNewProdCode] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('20000000');
  const [newProdDesc, setNewProdDesc] = useState('');

  const [entityNameInput, setEntityNameInput] = useState(currentProfile.config.terminology.entityName);
  const [pipelineNameInput, setPipelineNameInput] = useState(currentProfile.config.terminology.pipelineName);
  const [productLabelInput, setProductLabelInput] = useState(currentProfile.config.terminology.productLabel);
  const [valueLabelInput, setValueLabelInput] = useState(currentProfile.config.terminology.valueLabel);

  // Keep detail tab forms in sync when selected profile changes
  useEffect(() => {
    if (currentProfile) {
      setEntityNameInput(currentProfile.config.terminology.entityName);
      setPipelineNameInput(currentProfile.config.terminology.pipelineName);
      setProductLabelInput(currentProfile.config.terminology.productLabel);
      setValueLabelInput(currentProfile.config.terminology.valueLabel);
      const mins = currentProfile.config.unresponsiveAlertMinutes ?? 15;
      setUnresponsiveAlertMinutes(mins > 0 ? mins : 15);
      setIsAlertEnabled(mins > 0);
    }
  }, [currentProfile.id]);

  // Helper to update current profile config
  const updateCurrentProfileConfig = (updater: (prevConfig: WorkspaceConfig) => WorkspaceConfig) => {
    setProfiles((prev) =>
      prev.map((p) => {
        if (p.id !== currentProfile.id) return p;
        const nextCfg = updater(p.config);
        return {
          ...p,
          config: nextCfg,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    // If currently editing the active profile, synchronize with app context
    if (currentProfile.id === activeProfileId) {
      const nextCfg = updater(currentProfile.config);
      updateConfig(nextCfg);
    }
  };

  // --- Handlers for Profile Management ---
  const handleApplyProfile = (profileToApply: ConfigProfileItem) => {
    setActiveProfileId(profileToApply.id);
    updateConfig({
      ...profileToApply.config,
      domain: (profileToApply.domain in CLIENT_INDUSTRY_PRESETS ? profileToApply.domain : 'CUSTOM') as BusinessDomain,
    });
    notify.success(`Đã chọn áp dụng bộ thiết lập "${profileToApply.name}" cho hệ thống!`);
  };

  const handleCreateProfile = (newProfile: ConfigProfileItem) => {
    setProfiles((prev) => [newProfile, ...prev]);
    setSelectedProfileId(newProfile.id);
    setViewMode('detail');
    notify.success(`Đã tạo bộ thiết lập "${newProfile.name}" thành công!`);
  };

  const handleSaveProfileEdit = (profileId: string, data: { name: string; domain: string }) => {
    setProfiles((prev) =>
      prev.map((p) => {
        if (p.id !== profileId) return p;
        return {
          ...p,
          name: data.name,
          domain: data.domain,
          updatedAt: new Date().toISOString(),
        };
      })
    );
    if (profileId === activeProfileId) {
      updateConfig({
        domain: (data.domain in CLIENT_INDUSTRY_PRESETS ? data.domain : 'CUSTOM') as BusinessDomain,
      });
    }
    notify.success(`Đã cập nhật thông tin thiết lập "${data.name}"!`);
  };

  const handleDeleteProfile = (profileId: string) => {
    if (profiles.length <= 1) {
      notify.warning('Không thể xóa thiết lập duy nhất còn lại.');
      return;
    }

    const remaining = profiles.filter((p) => p.id !== profileId);
    setProfiles(remaining);

    if (activeProfileId === profileId) {
      const nextActive = remaining[0];
      setActiveProfileId(nextActive.id);
      updateConfig({
        ...nextActive.config,
        domain: (nextActive.domain in CLIENT_INDUSTRY_PRESETS ? nextActive.domain : 'CUSTOM') as BusinessDomain,
      });
      notify.info(`Đã tự động chuyển sang áp dụng thiết lập "${nextActive.name}".`);
    }

    if (selectedProfileId === profileId) {
      setSelectedProfileId(remaining[0].id);
      setViewMode('list');
    }

    notify.success('Đã xóa bộ thiết lập cấu hình.');
  };

  const handleResetProfileDefault = (profile: ConfigProfileItem) => {
    const domainKey = profile.domain in CLIENT_INDUSTRY_PRESETS ? profile.domain : 'EDUCATION';
    const preset = CLIENT_INDUSTRY_PRESETS[domainKey as BusinessDomain] || CLIENT_INDUSTRY_PRESETS.EDUCATION;

    updateCurrentProfileConfig((prev) => ({
      ...prev,
      terminology: { ...preset.terminology },
      pipelineStages: preset.pipelineStages.map((s) => ({ ...s })),
      productCatalog: preset.productCatalog.map((p) => ({ ...p })),
      criteria: preset.criteria.map((c) => ({ ...c })),
      unresponsiveAlertMinutes: 15,
    }));

    setEntityNameInput(preset.terminology.entityName);
    setPipelineNameInput(preset.terminology.pipelineName);
    setProductLabelInput(preset.terminology.productLabel);
    setValueLabelInput(preset.terminology.valueLabel);
    setUnresponsiveAlertMinutes(15);
    setIsAlertEnabled(true);

    notify.success(`Đã khôi phục thiết lập "${profile.name}" về mặc định ban đầu!`);
  };

  const handleSaveProfileNameInline = (profileId: string, newName: string) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, name: newName, updatedAt: new Date().toISOString() } : p))
    );
    notify.success('Đã đổi tên thiết lập cấu hình!');
  };

  // Helper format stage name
  const formatStageDisplayName = (name: string, index: number) => {
    const cleaned = name.replace(/^\d+[\.\s\-]+/, '').trim();
    return `${index + 1}. ${cleaned || name}`;
  };

  // --- Handlers for Tab Detail Items ---
  const handleCreateStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) {
      notify.warning('Vui lòng nhập tên giai đoạn phễu.');
      return;
    }

    const newStage: PipelineStageConfig = {
      id: `stage-${Date.now()}`,
      name: newStageName.trim(),
      subtitle: newStageSubtitle.trim() || 'Giai đoạn tùy biến',
      color: newStageColor.color,
      bgColor: newStageColor.bg,
      borderColor: newStageColor.border,
      isWon: newStageIsWon,
      isLost: newStageIsLost,
      isSystem: false,
      order: currentProfile.config.pipelineStages.length + 1,
    };

    updateCurrentProfileConfig((prev) => ({
      ...prev,
      pipelineStages: [...prev.pipelineStages, newStage],
    }));

    setNewStageName('');
    setNewStageSubtitle('');
    setNewStageIsWon(false);
    setNewStageIsLost(false);
    setIsAddStageModalOpen(false);
    notify.success('Đã thêm giai đoạn phễu mới!');
  };

  const startEditStage = (stage: PipelineStageConfig) => {
    setEditingStageId(stage.id);
    setEditStageName(stage.name.replace(/^\d+[\.\s\-]+/, '').trim());
    setEditStageSubtitle(stage.subtitle);
    const swatch = COLOR_SWATCHES.find((s) => s.color === stage.color) || COLOR_SWATCHES[0];
    setEditStageColor(swatch);
    setIsEditStageModalOpen(true);
  };

  const handleSaveEditStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStageId || !editStageName.trim()) {
      notify.warning('Tên giai đoạn không được để trống.');
      return;
    }

    updateCurrentProfileConfig((prev) => ({
      ...prev,
      pipelineStages: prev.pipelineStages.map((s) =>
        s.id === editingStageId
          ? {
              ...s,
              name: editStageName.trim(),
              subtitle: editStageSubtitle.trim(),
              color: editStageColor.color,
              bgColor: editStageColor.bg,
              borderColor: editStageColor.border,
            }
          : s
      ),
    }));

    setEditingStageId(null);
    setIsEditStageModalOpen(false);
    notify.success('Đã cập nhật thông tin giai đoạn!');
  };

  const handleDeleteStage = (stageId: string) => {
    updateCurrentProfileConfig((prev) => ({
      ...prev,
      pipelineStages: prev.pipelineStages.filter((s) => s.id !== stageId),
    }));
    notify.success('Đã xóa giai đoạn phễu!');
  };

  const handleReorderStages = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || toIndex < 0) return;
    const stages = [...currentProfile.config.pipelineStages];
    if (fromIndex >= stages.length || toIndex >= stages.length) return;

    const [moved] = stages.splice(fromIndex, 1);
    stages.splice(toIndex, 0, moved);

    updateCurrentProfileConfig((prev) => ({
      ...prev,
      pipelineStages: stages.map((s, idx) => ({ ...s, order: idx + 1 })),
    }));
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      notify.warning(`Vui lòng nhập tên ${currentProfile.config.terminology.productLabel.toLowerCase()}.`);
      return;
    }

    const newProd = {
      id: `prod-${Date.now()}`,
      name: newProdName.trim(),
      code: newProdCode.trim() || undefined,
      category: newProdCategory.trim() || 'Chung',
      defaultPrice: Number(newProdPrice) || 0,
      description: newProdDesc.trim() || undefined,
      isActive: true,
    };

    updateCurrentProfileConfig((prev) => ({
      ...prev,
      productCatalog: [...prev.productCatalog, newProd],
    }));

    setNewProdName('');
    setNewProdCode('');
    setNewProdCategory('');
    setNewProdPrice('20000000');
    setNewProdDesc('');
    setIsAddProductModalOpen(false);
    notify.success(`Đã thêm ${currentProfile.config.terminology.productLabel.toLowerCase()} mới thành công!`);
  };

  const handleDeleteProduct = (productId: string) => {
    updateCurrentProfileConfig((prev) => ({
      ...prev,
      productCatalog: prev.productCatalog.filter((p) => p.id !== productId),
    }));
    notify.success('Đã xóa sản phẩm / dịch vụ!');
  };

  const handleSaveTerminology = (e: React.FormEvent) => {
    e.preventDefault();
    updateCurrentProfileConfig((prev) => ({
      ...prev,
      terminology: {
        entityName: entityNameInput.trim() || prev.terminology.entityName,
        pipelineName: pipelineNameInput.trim() || prev.terminology.pipelineName,
        productLabel: productLabelInput.trim() || prev.terminology.productLabel,
        valueLabel: valueLabelInput.trim() || prev.terminology.valueLabel,
      },
    }));
    notify.success('Đã lưu cấu hình thuật ngữ thiết lập!');
  };

  const handleCreateCriteria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCritName.trim()) {
      notify.warning('Vui lòng nhập tên tiêu chí đánh giá.');
      return;
    }

    const opts = newCritType === 'SELECT'
      ? newCritOptions.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined;

    const newCrit = {
      id: `crit-${Date.now()}`,
      name: newCritName.trim(),
      type: newCritType,
      options: opts,
      isRequired: newCritRequired,
    };

    updateCurrentProfileConfig((prev) => ({
      ...prev,
      criteria: [...prev.criteria, newCrit],
    }));

    setNewCritName('');
    setNewCritOptions('');
    setNewCritRequired(false);
    setIsAddCriteriaModalOpen(false);
    notify.success('Đã thêm tiêu chí đánh giá mới!');
  };

  const handleDeleteCriteria = (critId: string) => {
    updateCurrentProfileConfig((prev) => ({
      ...prev,
      criteria: prev.criteria.filter((c) => c.id !== critId),
    }));
    notify.success('Đã xóa tiêu chí đánh giá!');
  };

  const handleSaveAlertSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const finalMinutes = isAlertEnabled ? Math.max(1, Number(unresponsiveAlertMinutes) || 15) : 0;
    updateCurrentProfileConfig((prev) => ({
      ...prev,
      unresponsiveAlertMinutes: finalMinutes,
    }));
    notify.success(
      finalMinutes > 0
        ? `Đã cập nhật cảnh báo tin nhắn chưa phản hồi sau ${finalMinutes} phút!`
        : 'Đã tắt cảnh báo tin nhắn chưa phản hồi.'
    );
  };

  const handleSaveWorkingHours = (newWorkingHours: WorkingHoursConfig) => {
    updateCurrentProfileConfig((prev) => ({
      ...prev,
      workingHours: newWorkingHours,
    }));
    notify.success('Đã lưu cấu hình khung giờ làm việc và phản hồi ngoài giờ!');
  };

  // Tab definitions
  const tabItems: TabItem<SettingsTabId>[] = [
    {
      id: 'stages',
      label: 'Giai đoạn phễu',
      count: currentProfile.config.pipelineStages.length,
    },
    {
      id: 'catalog',
      label: currentProfile.config.terminology.productLabel || 'Sản phẩm & Dịch vụ',
      count: currentProfile.config.productCatalog.length,
    },
    {
      id: 'terminology',
      label: 'Thuật ngữ hệ thống',
    },
    {
      id: 'criteria',
      label: 'Tiêu chí phân loại',
      count: currentProfile.config.criteria.length,
    },
    {
      id: 'workingHours',
      label: 'Giờ làm việc & Tự động trả lời',
    },
    {
      id: 'alerts',
      label: 'Cảnh báo phản hồi',
    },
  ];

  // =========================================================================
  // VIEW 1: DANH SÁCH THIẾT LẬP (LIST VIEW - GIỐNG WORKSPACE LIST PAGE)
  // =========================================================================
  if (viewMode === 'list') {
    return (
      <>
        <ConfigListPage
          profiles={profiles}
          activeProfileId={activeProfileId}
          isOwner={isOwner}
          onSelectApply={handleApplyProfile}
          onViewDetail={(item) => {
            setSelectedProfileId(item.id);
            setViewMode('detail');
          }}
          onCreateNew={() => setIsCreateConfigModalOpen(true)}
          onEdit={(item) => setEditingProfile(item)}
          onDelete={(item) => setDeletingProfile(item)}
        />

        {/* Modal Thêm thiết lập mới */}
        <CreateConfigModal
          isOpen={isCreateConfigModalOpen}
          onClose={() => setIsCreateConfigModalOpen(false)}
          currentActiveConfig={config}
          onCreate={handleCreateProfile}
        />

        {/* Modal Sửa thiết lập */}
        <EditConfigModal
          isOpen={Boolean(editingProfile)}
          onClose={() => setEditingProfile(null)}
          profile={editingProfile}
          onSave={handleSaveProfileEdit}
        />

        {/* Modal Xóa thiết lập */}
        <DeleteConfigModal
          isOpen={Boolean(deletingProfile)}
          onClose={() => setDeletingProfile(null)}
          profile={deletingProfile}
          isActive={deletingProfile?.id === activeProfileId}
          canDelete={profiles.length > 1}
          onConfirm={handleDeleteProfile}
        />
      </>
    );
  }

  // =========================================================================
  // VIEW 2: CHI TIẾT THIẾT LẬP (DETAIL VIEW - HEADER LÀ THUẬT NGỮ THIẾT LẬP)
  // =========================================================================
  return (
    <div className="p-3 sm:p-4 max-w-[1600px] mx-auto min-h-full space-y-3.5 sm:space-y-4">
      {/* 1. Header Chi Tiết Thiết Lập Đồng Bộ (Header là Thuật Ngữ Thiết Lập) */}
      <ConfigDetailHeader
        profile={currentProfile}
        isActive={currentProfile.id === activeProfileId}
        isOwner={isOwner}
        onBack={() => setViewMode('list')}
        onSelectApply={() => handleApplyProfile(currentProfile)}
        onEdit={() => setEditingProfile(currentProfile)}
        onDelete={() => setDeletingProfile(currentProfile)}
        onResetDefault={() => handleResetProfileDefault(currentProfile)}
        onSaveNameInline={(newName) => handleSaveProfileNameInline(currentProfile.id, newName)}
      />

      {/* 2. Thanh Chuyển Tab Trượt Gạch Dưới Chuẩn Hệ Thống */}
      <Tabs<SettingsTabId>
        items={tabItems}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* 3. Nội Dung Tab 1: Cấu hình Giai đoạn Phễu */}
      {activeTab === 'stages' && (
        <div className="w-full space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider m-0">
                Giai đoạn phễu quy trình ({currentProfile.config.pipelineStages.length})
              </h3>
              <p className="text-[11px] text-slate-500 m-0">
                Tự do kéo chỉnh thứ tự, cập nhật trạng thái chốt/hủy và màu sắc nhận diện từng bước
              </p>
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsAddStageModalOpen(true)}
                className="h-8 px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors shrink-0"
              >
                <Plus size={14} />
                <span>Thêm giai đoạn</span>
              </button>
            )}
          </div>

          {/* Live Preview Mini Card */}
          <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs w-full">
            <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center justify-between">
              <span>Dòng chảy phễu trực quan:</span>
              <span className="text-[11px] text-slate-400 font-normal">Kéo cuộn ngang để xem tất cả</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {currentProfile.config.pipelineStages.map((s, idx) => (
                <div
                  key={s.id}
                  className="px-2.5 py-1 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 rounded-lg border shadow-2xs"
                  style={{
                    backgroundColor: s.bgColor,
                    borderColor: s.borderColor,
                    color: s.color,
                  }}
                >
                  <span>{formatStageDisplayName(s.name, idx)}</span>
                  {s.isWon && <span className="text-emerald-600 text-xs">★</span>}
                  {s.isLost && <span className="text-slate-400 text-xs">✕</span>}
                </div>
              ))}
            </div>
          </div>

          {/* List Stages Cards */}
          <div className="space-y-2 w-full">
            {currentProfile.config.pipelineStages.map((stage, index) => (
              <div
                key={stage.id}
                className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3.5 h-3.5 shrink-0 rounded-full border shadow-2xs"
                    style={{ backgroundColor: stage.color, borderColor: stage.borderColor }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {formatStageDisplayName(stage.name, index)}
                      </span>
                      {stage.isWon && (
                        <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-md">
                          Chốt thành công
                        </span>
                      )}
                      {stage.isLost && (
                        <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 rounded-md">
                          Thất bại / Hủy
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {stage.subtitle}
                    </div>
                  </div>
                </div>

                {isOwner && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleReorderStages(index, index - 1)}
                      title="Di chuyển lên"
                      className="h-7 w-7 rounded-md text-slate-500 hover:text-slate-900 border border-transparent hover:border-slate-200 hover:bg-slate-50 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={index === currentProfile.config.pipelineStages.length - 1}
                      onClick={() => handleReorderStages(index, index + 1)}
                      title="Di chuyển xuống"
                      className="h-7 w-7 rounded-md text-slate-500 hover:text-slate-900 border border-transparent hover:border-slate-200 hover:bg-slate-50 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditStage(stage)}
                      title="Sửa giai đoạn"
                      className="h-7 w-7 rounded-md text-slate-500 hover:text-blue-600 border border-transparent hover:border-blue-200 hover:bg-blue-50 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStage(stage.id)}
                      title="Xóa giai đoạn"
                      className="h-7 w-7 rounded-md text-slate-500 hover:text-rose-600 border border-transparent hover:border-rose-200 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Nội Dung Tab 2: Danh Mục Sản Phẩm / Dịch Vụ */}
      {activeTab === 'catalog' && (
        <div className="w-full space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider m-0">
                Danh Sách {currentProfile.config.terminology.productLabel || 'Sản Phẩm & Dịch Vụ'} ({currentProfile.config.productCatalog.length})
              </h3>
              <p className="text-[11px] text-slate-500 m-0">
                Bảng giá niêm yết và phân loại danh mục kinh doanh trực thuộc bộ thiết lập này
              </p>
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsAddProductModalOpen(true)}
                className="h-8 px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors shrink-0"
              >
                <Plus size={14} />
                <span>Thêm {currentProfile.config.terminology.productLabel ? currentProfile.config.terminology.productLabel.toLowerCase() : 'mục mới'}</span>
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs w-full">
            {currentProfile.config.productCatalog.length === 0 ? (
              <EmptyState
                title={`Chưa có ${currentProfile.config.terminology.productLabel ? currentProfile.config.terminology.productLabel.toLowerCase() : 'sản phẩm / dịch vụ'} nào`}
                description="Hãy nhấn nút Thêm ở trên để tạo sản phẩm, khóa học hoặc dịch vụ kinh doanh mới."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 font-semibold text-[11px]">
                      <th className="px-4 py-2.5">Tên mục</th>
                      <th className="px-4 py-2.5">Mã định danh</th>
                      <th className="px-4 py-2.5">Nhóm / Danh mục</th>
                      <th className="px-4 py-2.5 text-right">Giá niêm yết</th>
                      {isOwner && <th className="px-4 py-2.5 text-center w-16">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentProfile.config.productCatalog.map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-slate-900">
                          {prod.name}
                          {prod.description && (
                            <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                              {prod.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 font-mono text-[11px]">
                          {prod.code || '—'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200 rounded-md">
                            {prod.category}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-blue-600 font-mono text-xs whitespace-nowrap">
                          {new Intl.NumberFormat('vi-VN').format(prod.defaultPrice)} đ
                        </td>
                        {isOwner && (
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(prod.id)}
                              title="Xóa mục"
                              className="h-6 w-6 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Nội Dung Tab 3: Thuật Ngữ Hệ Thống */}
      {activeTab === 'terminology' && (
        <div className="w-full">
          <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-4 w-full">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center shrink-0">
                <Tag size={14} />
              </div>
              <div>
                <h4 className="m-0 text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Cấu Hình Nhãn Thuật Ngữ Hiển Thị Trên Giao Diện
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5 mb-0">
                  Tự động đồng bộ tên gọi hiển thị theo toàn bộ hệ thống quản lý phễu, modal hồ sơ và bảng phân tích.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveTerminology} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên thực thể khách hàng (Hiển thị tại Cột Hồ Sơ & Modal)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Thí sinh / Học viên, Khách mua BĐS, Khách hàng"
                    value={entityNameInput}
                    onChange={(e) => setEntityNameInput(e.target.value)}
                    disabled={!isOwner}
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên gọi của Bảng Phễu (Bảng Kanban)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Phễu Tuyển Sinh & Đào Tạo, Phễu Bán Hàng"
                    value={pipelineNameInput}
                    onChange={(e) => setPipelineNameInput(e.target.value)}
                    disabled={!isOwner}
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên gọi danh mục kinh doanh (Sản phẩm / Dịch vụ / Khóa học / BĐS...)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Sản phẩm / Dịch vụ, Khóa học, Gói liệu trình, Căn hộ / Dự án..."
                    value={productLabelInput}
                    onChange={(e) => setProductLabelInput(e.target.value)}
                    disabled={!isOwner}
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên gọi Doanh số / Học phí dự kiến
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Học phí dự kiến (VNĐ), Giá trị đơn hàng, Giá trị giao dịch"
                    value={valueLabelInput}
                    onChange={(e) => setValueLabelInput(e.target.value)}
                    disabled={!isOwner}
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs disabled:bg-slate-50"
                  />
                </div>
              </div>

              {isOwner && (
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="h-8 px-4 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                  >
                    <Save size={13} />
                    <span>Lưu Cấu Hình Thuật Ngữ</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* 6. Tab Tiêu Chí Đánh Giá / Phân Loại */}
      {activeTab === 'criteria' && (
        <div className="w-full space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider m-0">
                Tiêu Chí Đánh Giá & Phân Loại ({currentProfile.config.criteria.length})
              </h3>
              <p className="text-[11px] text-slate-500 m-0">
                Các câu hỏi, tiêu chuẩn sàng lọc ứng viên/khách hàng được lưu vào cơ sở dữ liệu theo tài khoản Chủ doanh nghiệp.
              </p>
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsAddCriteriaModalOpen(true)}
                className="h-8 px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors shrink-0"
              >
                <Plus size={14} />
                <span>Thêm tiêu chí</span>
              </button>
            )}
          </div>

          {currentProfile.config.criteria.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
              <EmptyState
                title="Chưa có tiêu chí đánh giá nào"
                description="Hãy nhấn nút Thêm tiêu chí ở trên để tạo câu hỏi sàng lọc khách hàng."
              />
            </div>
          ) : (
            <div className="space-y-2 w-full">
              {currentProfile.config.criteria.map((crit) => (
                <div
                  key={crit.id}
                  className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-slate-900">
                        {crit.name}
                      </span>
                      <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 rounded-md">
                        {crit.type}
                      </span>
                      {crit.isRequired && (
                        <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 rounded-md">
                          Bắt buộc
                        </span>
                      )}
                    </div>
                    {crit.options && crit.options.length > 0 && (
                      <div className="text-[11px] text-slate-500">
                        Tùy chọn: {crit.options.join(', ')}
                      </div>
                    )}
                  </div>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCriteria(crit.id)}
                      title="Xóa tiêu chí"
                      className="h-6 w-6 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. Tab Cảnh Báo Phản Hồi Tin Nhắn */}
      {activeTab === 'alerts' && (
        <div className="w-full">
          <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-4 w-full">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shadow-2xs shrink-0">
                <Clock size={14} />
              </div>
              <div>
                <h4 className="m-0 text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Cảnh Báo Tin Nhắn Chưa Phản Hồi (SLA)
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5 mb-0">
                  Tự động gắn cờ cảnh báo trên danh sách tin nhắn Inbox khi khách nhắn tin nhưng tư vấn viên chưa phản hồi sau n phút.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveAlertSettings} className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
                <input
                  type="checkbox"
                  id="enableAlertToggle"
                  checked={isAlertEnabled}
                  onChange={(e) => setIsAlertEnabled(e.target.checked)}
                  disabled={!isOwner}
                  className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                />
                <label htmlFor="enableAlertToggle" className="cursor-pointer">
                  <span className="block text-xs font-bold text-slate-800">
                    Bật tính năng cảnh báo tin nhắn chậm phản hồi
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    Hệ thống đo lường thời gian từ lúc khách gửi tin nhắn cuối cùng nếu chưa có phản hồi từ nhân viên tư vấn.
                  </span>
                </label>
              </div>

              {isAlertEnabled && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-3.5 bg-rose-50/30 border border-rose-200/80 rounded-xl">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Thời gian chờ tối đa trước khi cảnh báo (phút):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          placeholder="15"
                          value={unresponsiveAlertMinutes}
                          onChange={(e) => setUnresponsiveAlertMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          disabled={!isOwner}
                          className="w-28 h-8 px-2.5 text-xs font-bold text-slate-800 border border-slate-300 rounded-lg outline-none focus:border-rose-500 bg-white shadow-2xs"
                        />
                        <span className="text-xs text-slate-600 font-medium">phút</span>
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] font-medium text-slate-500 mb-1.5">
                        Gợi ý mốc thời gian nhanh:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[5, 10, 15, 30, 60, 120].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setUnresponsiveAlertMinutes(mins)}
                            disabled={!isOwner}
                            className={`h-7 px-2.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                              unresponsiveAlertMinutes === mins
                                ? 'bg-blue-50 text-blue-600 border-blue-200/80 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {mins} phút
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-rose-200/60 pt-3 lg:pt-0 lg:pl-4">
                    <span className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                      Hiển thị xem trước trên giao diện Inbox:
                    </span>
                    <div className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-rose-200/80 shadow-2xs">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-md leading-none shrink-0">
                        <Clock size={11} className="text-rose-600 animate-pulse" />
                        Chưa trả lời {unresponsiveAlertMinutes}p
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Gắn cờ đỏ nổi bật và hỗ trợ lọc nhanh hội thoại vượt quá {unresponsiveAlertMinutes} phút.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {isOwner && (
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="h-8 px-4 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                  >
                    <Save size={13} />
                    <span>Lưu Cấu Hình Cảnh Báo</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* 8. Tab Khung Giờ Làm Việc & Tự Động Trả Lời */}
      {activeTab === 'workingHours' && (
        <WorkingHoursTab
          workingHours={currentProfile.config.workingHours}
          isOwner={isOwner}
          isLoading={isLoading}
          onSave={handleSaveWorkingHours}
        />
      )}

      {/* ========================================================
          MODAL 1: THÊM GIAI ĐOẠN PHỄU MỚI
          ======================================================== */}
      <Modal
        isOpen={isAddStageModalOpen}
        onClose={() => setIsAddStageModalOpen(false)}
        title="Thêm Giai Đoạn Phễu Mới"
        description="Định nghĩa bước chuyển đổi khách hàng tiếp theo trong quy trình bán hàng & tuyển sinh."
        size="md"
        variant="flat"
        showCloseButton={true}
      >
        <form onSubmit={handleCreateStage} className="space-y-3.5 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên giai đoạn *
            </label>
            <input
              type="text"
              placeholder="VD: Hẹn phỏng vấn trực tiếp"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mô tả / Phụ đề
            </label>
            <input
              type="text"
              placeholder="VD: Khách đã xác nhận lịch gặp văn phòng"
              value={newStageSubtitle}
              onChange={(e) => setNewStageSubtitle(e.target.value)}
              className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Màu sắc nhận diện
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.color}
                  type="button"
                  onClick={() => setNewStageColor(swatch)}
                  className={`w-6 h-6 rounded-md border transition-all cursor-pointer ${
                    newStageColor.color === swatch.color
                      ? 'border-slate-900 ring-2 ring-slate-900/20 scale-105'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: swatch.color }}
                  title={swatch.name}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newStageIsWon}
                onChange={(e) => {
                  setNewStageIsWon(e.target.checked);
                  if (e.target.checked) setNewStageIsLost(false);
                }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Đánh dấu là giai đoạn Chốt thành công (Won)</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newStageIsLost}
                onChange={(e) => {
                  setNewStageIsLost(e.target.checked);
                  if (e.target.checked) setNewStageIsWon(false);
                }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Đánh dấu là giai đoạn Thất bại / Hủy (Lost)</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddStageModalOpen(false)}
              className="h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="h-8 px-4 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus size={13} />
              <span>Thêm Vào Phễu</span>
            </button>
          </div>
        </form>
      </Modal>



      {/* ========================================================
          MODAL 2: CHỈNH SỬA GIAI ĐOẠN PHỄU
          ======================================================== */}
      <Modal
        isOpen={isEditStageModalOpen}
        onClose={() => setIsEditStageModalOpen(false)}
        title="Chỉnh Sửa Giai Đoạn Phễu"
        description="Cập nhật tên gọi, mô tả ngắn hoặc màu sắc đại diện của giai đoạn này."
        size="md"
        variant="flat"
        showCloseButton={true}
      >
        <form onSubmit={handleSaveEditStage} className="space-y-3.5 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên giai đoạn *
            </label>
            <input
              type="text"
              value={editStageName}
              onChange={(e) => setEditStageName(e.target.value)}
              className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mô tả phụ đề
            </label>
            <input
              type="text"
              value={editStageSubtitle}
              onChange={(e) => setEditStageSubtitle(e.target.value)}
              className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Màu sắc nhận diện
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.color}
                  type="button"
                  onClick={() => setEditStageColor(swatch)}
                  className={`w-6 h-6 rounded-md border transition-all cursor-pointer ${
                    editStageColor.color === swatch.color
                      ? 'border-slate-900 ring-2 ring-slate-900/20 scale-105'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: swatch.color }}
                  title={swatch.name}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditStageModalOpen(false)}
              className="h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="h-8 px-4 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Save size={13} />
              <span>Lưu Thay Đổi</span>
            </button>
          </div>
        </form>
      </Modal>



      {/* ========================================================
          MODAL 3: THÊM SẢN PHẨM / DỊCH VỤ MỚI
          ======================================================== */}
      <Modal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        title={`Thêm ${currentProfile.config.terminology.productLabel || 'Sản Phẩm / Dịch Vụ'} Mới`}
        description={`Định cấu hình ${currentProfile.config.terminology.productLabel ? currentProfile.config.terminology.productLabel.toLowerCase() : 'sản phẩm / dịch vụ'} để gắn vào hồ sơ khách hàng.`}
        size="md"
        variant="flat"
        showCloseButton={true}
      >
        <form onSubmit={handleCreateProduct} className="space-y-3.5 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên gọi *
            </label>
            <input
              type="text"
              placeholder="VD: Gói dịch vụ tư vấn, Sản phẩm tiêu chuẩn, Khóa đào tạo..."
              value={newProdName}
              onChange={(e) => setNewProdName(e.target.value)}
              className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã định danh (Code)
              </label>
              <input
                type="text"
                placeholder="VD: SP-01, DV-01, PKG-ADV"
                value={newProdCode}
                onChange={(e) => setNewProdCode(e.target.value)}
                className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nhóm / Phân loại
              </label>
              <input
                type="text"
                placeholder="VD: Tiêu chuẩn, Cao cấp, Trọn gói"
                value={newProdCategory}
                onChange={(e) => setNewProdCategory(e.target.value)}
                className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Giá niêm yết mặc định (VNĐ)
            </label>
            <input
              type="number"
              step="100000"
              value={newProdPrice}
              onChange={(e) => setNewProdPrice(e.target.value)}
              className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mô tả ngắn
            </label>
            <textarea
              rows={2}
              placeholder="Mô tả thông tin quyền lợi gói dịch vụ / sản phẩm..."
              value={newProdDesc}
              onChange={(e) => setNewProdDesc(e.target.value)}
              className="w-full p-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddProductModalOpen(false)}
              className="h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="h-8 px-4 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus size={13} />
              <span>Thêm Vào Danh Mục</span>
            </button>
          </div>
        </form>
      </Modal>



      {/* ========================================================
          MODAL 4: THÊM TIÊU CHÍ PHÂN LOẠI MỚI
          ======================================================== */}
      <Modal
        isOpen={isAddCriteriaModalOpen}
        onClose={() => setIsAddCriteriaModalOpen(false)}
        title="Thêm Tiêu Chí Đánh Giá Mới"
        description="Định cấu hình các câu hỏi, tiêu chí phân loại để nhân viên tư vấn thu thập từ khách hàng."
        size="md"
        variant="flat"
        showCloseButton={true}
      >
        <form onSubmit={handleCreateCriteria} className="space-y-3.5 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên tiêu chí *
            </label>
            <input
              type="text"
              placeholder="VD: Trình độ học vấn, Tầm tài chính..."
              value={newCritName}
              onChange={(e) => setNewCritName(e.target.value)}
              className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kiểu dữ liệu
            </label>
            <select
              value={newCritType}
              onChange={(e) => setNewCritType(e.target.value as any)}
              className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:border-blue-500 shadow-2xs cursor-pointer"
            >
              <option value="TEXT">Văn bản (Text)</option>
              <option value="SELECT">Chọn một (Dropdown Select)</option>
              <option value="NUMBER">Số liệu (Number)</option>
              <option value="BOOLEAN">Có / Không (Boolean)</option>
            </select>
          </div>

          {newCritType === 'SELECT' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Các tùy chọn (phân cách bằng dấu phẩy)
              </label>
              <input
                type="text"
                placeholder="VD: THPT, Trung cấp, Đại học, Đi làm"
                value={newCritOptions}
                onChange={(e) => setNewCritOptions(e.target.value)}
                className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs"
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <input
              type="checkbox"
              id="critRequiredModal"
              checked={newCritRequired}
              onChange={(e) => setNewCritRequired(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="critRequiredModal" className="text-xs text-slate-700 cursor-pointer">
              Tiêu chuẩn bắt buộc phải thu thập
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddCriteriaModalOpen(false)}
              className="h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="h-8 px-4 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus size={13} />
              <span>Thêm Tiêu Chí</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Thêm thiết lập mới (nếu mở từ detail) */}
      <CreateConfigModal
        isOpen={isCreateConfigModalOpen}
        onClose={() => setIsCreateConfigModalOpen(false)}
        currentActiveConfig={config}
        onCreate={handleCreateProfile}
      />

      {/* Modal Sửa thiết lập */}
      <EditConfigModal
        isOpen={Boolean(editingProfile)}
        onClose={() => setEditingProfile(null)}
        profile={editingProfile}
        onSave={handleSaveProfileEdit}
      />

      {/* Modal Xóa thiết lập */}
      <DeleteConfigModal
        isOpen={Boolean(deletingProfile)}
        onClose={() => setDeletingProfile(null)}
        profile={deletingProfile}
        isActive={deletingProfile?.id === activeProfileId}
        canDelete={profiles.length > 1}
        onConfirm={handleDeleteProfile}
      />
    </div>
  );
};
