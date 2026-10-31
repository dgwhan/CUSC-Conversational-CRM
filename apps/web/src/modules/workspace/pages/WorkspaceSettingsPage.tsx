import React, { useState } from 'react';
import {
  Layers,
  GraduationCap,
  Building2,
  Sparkles,
  Server,
  ShoppingBag,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit2,
  Check,
  Save,
  RotateCcw,
  ShieldAlert,
  Sliders,
  BookOpen,
  Tag,
  Palette,
  X,
} from 'lucide-react';
import { useWorkspaceConfig } from '../WorkspaceConfigContext.js';
import { useUserRole } from '../../auth/UserRoleContext.js';
import type { BusinessDomain, PipelineStageConfig } from '../workspaceConfig.types.js';
import { notify } from '../../../components/feedback/toastEmitter.js';
import {
  PageHeader,
  PageSection,
  Tabs,
  Button,
  EmptyState,
} from '../../../components/ui/index.js';

const COLOR_SWATCHES = [
  { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', name: 'Xanh Lam' },
  { color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', name: 'Chàm Indigo' },
  { color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', name: 'Tím Violet' },
  { color: '#d97706', bg: '#fffbeb', border: '#fde68a', name: 'Hổ Phách' },
  { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', name: 'Cam Đậm' },
  { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', name: 'Xanh Mòng Két' },
  { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', name: 'Xanh Lá (Thành công)' },
  { color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8', name: 'Hồng Phấn' },
  { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', name: 'Xám Đá (Thất bại)' },
];

export const WorkspaceSettingsPage: React.FC = () => {
  const {
    config,
    isLoading,
    applyPreset,
    updateConfig,
    addStage,
    updateStage,
    deleteStage,
    reorderStages,
    addProduct,
    deleteProduct,
    addCriteria,
    deleteCriteria,
    resetToDefault,
  } = useWorkspaceConfig();

  const { isOwner } = useUserRole();

  const [activeTab, setActiveTab] = useState<'stages' | 'catalog' | 'terminology' | 'criteria'>('stages');

  // Form thêm tiêu chí mới
  const [newCritName, setNewCritName] = useState('');
  const [newCritType, setNewCritType] = useState<'TEXT' | 'SELECT' | 'NUMBER' | 'BOOLEAN'>('TEXT');
  const [newCritOptions, setNewCritOptions] = useState('');
  const [newCritRequired, setNewCritRequired] = useState(false);

  // Form thêm stage mới
  const [newStageName, setNewStageName] = useState('');
  const [newStageSubtitle, setNewStageSubtitle] = useState('');
  const [newStageColor, setNewStageColor] = useState(COLOR_SWATCHES[0]);
  const [newStageIsWon, setNewStageIsWon] = useState(false);
  const [newStageIsLost, setNewStageIsLost] = useState(false);

  // Form chỉnh sửa stage
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState('');
  const [editStageSubtitle, setEditStageSubtitle] = useState('');
  const [editStageColor, setEditStageColor] = useState(COLOR_SWATCHES[0]);

  // Form thêm sản phẩm/khóa học
  const [newProdName, setNewProdName] = useState('');
  const [newProdCode, setNewProdCode] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('20000000');
  const [newProdDesc, setNewProdDesc] = useState('');

  // Form thuật ngữ thuần túy
  const [entityNameInput, setEntityNameInput] = useState(config.terminology.entityName);
  const [pipelineNameInput, setPipelineNameInput] = useState(config.terminology.pipelineName);
  const [productLabelInput, setProductLabelInput] = useState(config.terminology.productLabel);
  const [valueLabelInput, setValueLabelInput] = useState(config.terminology.valueLabel);

  const presetsList: { key: BusinessDomain; title: string; subtitle: string; icon: React.ReactNode }[] = [
    {
      key: 'EDUCATION',
      title: 'Giáo Dục & Tuyển Sinh (CUSC)',
      subtitle: 'Khóa học Aptech, Arena, Python AI; Thí sinh & Học phí',
      icon: <GraduationCap size={18} className="text-blue-600" />,
    },
    {
      key: 'REAL_ESTATE',
      title: 'Bất Động Sản & Dự Án',
      subtitle: 'Căn hộ, Biệt thự, Đất nền; Hẹn xem nhà mẫu & Đặt cọc',
      icon: <Building2 size={18} className="text-amber-600" />,
    },
    {
      key: 'BEAUTY_SPA',
      title: 'Thẩm Mỹ Viện & Spa',
      subtitle: 'Phác đồ soi da, Liệu trình trị nám, Đặt lịch hẹn cơ sở',
      icon: <Sparkles size={18} className="text-rose-600" />,
    },
    {
      key: 'B2B_SAAS',
      title: 'B2B SaaS & Phần Mềm',
      subtitle: 'Phần mềm CRM, Cloud; Lịch Demo & Hợp đồng ARR',
      icon: <Server size={18} className="text-indigo-600" />,
    },
    {
      key: 'RETAIL',
      title: 'Bán Lẻ & Thương Mại Online',
      subtitle: 'Sản phẩm thời trang, Đơn COD, Giao hàng chốt đơn',
      icon: <ShoppingBag size={18} className="text-emerald-600" />,
    },
  ];

  const handleCreateStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) {
      notify.warning('Vui lòng nhập tên giai đoạn phễu.');
      return;
    }

    addStage({
      name: newStageName.trim(),
      subtitle: newStageSubtitle.trim() || 'Giai đoạn tùy biến',
      color: newStageColor.color,
      bgColor: newStageColor.bg,
      borderColor: newStageColor.border,
      isWon: newStageIsWon,
      isLost: newStageIsLost,
      isSystem: false,
    });

    setNewStageName('');
    setNewStageSubtitle('');
    setNewStageIsWon(false);
    setNewStageIsLost(false);
  };

  const startEditStage = (stage: PipelineStageConfig) => {
    setEditingStageId(stage.id);
    setEditStageName(stage.name);
    setEditStageSubtitle(stage.subtitle);
    const swatch = COLOR_SWATCHES.find((s) => s.color === stage.color) || COLOR_SWATCHES[0];
    setEditStageColor(swatch);
  };

  const handleSaveEditStage = (stageId: string) => {
    if (!editStageName.trim()) {
      notify.warning('Tên giai đoạn không được để trống.');
      return;
    }

    updateStage(stageId, {
      name: editStageName.trim(),
      subtitle: editStageSubtitle.trim(),
      color: editStageColor.color,
      bgColor: editStageColor.bg,
      borderColor: editStageColor.border,
    });

    setEditingStageId(null);
    notify.success('Đã cập nhật thông tin giai đoạn!');
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      notify.warning(`Vui lòng nhập tên ${config.terminology.productLabel.toLowerCase()}.`);
      return;
    }

    addProduct({
      name: newProdName.trim(),
      code: newProdCode.trim() || undefined,
      category: newProdCategory.trim() || 'Chung',
      defaultPrice: Number(newProdPrice) || 0,
      description: newProdDesc.trim() || undefined,
      isActive: true,
    });

    setNewProdName('');
    setNewProdCode('');
    setNewProdCategory('');
    setNewProdPrice('20000000');
    setNewProdDesc('');
  };

  const handleSaveTerminology = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig({
      terminology: {
        entityName: entityNameInput.trim() || config.terminology.entityName,
        pipelineName: pipelineNameInput.trim() || config.terminology.pipelineName,
        productLabel: productLabelInput.trim() || config.terminology.productLabel,
        valueLabel: valueLabelInput.trim() || config.terminology.valueLabel,
      },
    });
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

    addCriteria({
      name: newCritName.trim(),
      type: newCritType,
      options: opts,
      isRequired: newCritRequired,
    });

    setNewCritName('');
    setNewCritOptions('');
    setNewCritRequired(false);
  };

  const tabItems = [
    {
      id: 'stages',
      label: 'Giai đoạn phễu',
      count: config.pipelineStages.length,
      icon: <Layers size={14} />,
    },
    {
      id: 'catalog',
      label: config.terminology.productLabel,
      count: config.productCatalog.length,
      icon: <BookOpen size={14} />,
    },
    {
      id: 'terminology',
      label: 'Thuật ngữ hệ thống',
      icon: <Tag size={14} />,
    },
    {
      id: 'criteria',
      label: 'Tiêu chí phân loại',
      count: config.criteria.length,
      icon: <Sliders size={14} />,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Header Cấu Hình */}
      <PageHeader
        title="Quản lý cấu hình"
        description="Thiết lập tiêu chuẩn phễu bán hàng/tuyển sinh, danh mục sản phẩm, khóa học, tiêu chí sàng lọc và thuật ngữ hệ thống."
        actions={
          <div className="flex items-center gap-3">
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetToDefault}
                icon={<RotateCcw size={14} />}
                title="Khôi phục về cấu hình mẫu CUSC ban đầu"
              >
                Mặc định CUSC
              </Button>
            )}
            <span
              className={`px-3 py-1 text-xs font-semibold border ${
                isOwner
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {isOwner ? '👑 Quyền: Chủ Doanh Nghiệp (Owner)' : '🎧 Quyền: Tư Vấn Viên (Chỉ Đọc)'}
            </span>
          </div>
        }
      />

      {/* Cảnh báo nếu là Agent */}
      {!isOwner && (
        <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <ShieldAlert size={16} className="text-amber-600 shrink-0" />
          <span>
            Bạn đang đăng nhập với vai trò <strong>Tư vấn viên (Agent)</strong>. Giao diện đang ở chế độ xem; chỉ Chủ doanh nghiệp mới có quyền lưu thay đổi hoặc chuyển đổi mô hình ngành nghề.
          </span>
        </div>
      )}

      {/* 2. Bộ Mẫu Ngành Nghề Nhanh (1-Click Industry Presets) */}
      <PageSection
        title="Chuyển đổi nhanh theo ngành nghề"
        subtitle="Áp dụng mẫu cấu hình phễu và danh mục tiêu chuẩn cho từng mô hình doanh nghiệp"
        actions={
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Palette size={14} className="text-blue-600" />
            <span>5 Mẫu có sẵn</span>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {presetsList.map((preset) => {
            const isActive = config.domain === preset.key;
            return (
              <div
                key={preset.key}
                onClick={() => isOwner && applyPreset(preset.key)}
                className={`p-3.5 border transition-all text-left relative ${
                  isActive
                    ? 'border-blue-600 bg-blue-50/40 text-blue-900'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
                } ${isOwner ? 'cursor-pointer' : 'cursor-default opacity-70'}`}
              >
                {isActive && (
                  <span className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5">
                    Đang dùng
                  </span>
                )}
                <div className="mb-2">{preset.icon}</div>
                <div className="text-xs font-bold text-slate-900 mb-1">{preset.title}</div>
                <div className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{preset.subtitle}</div>
              </div>
            );
          })}
        </div>
      </PageSection>

      {/* 3. Thanh Chuyển Tab */}
      <Tabs
        items={tabItems}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as any)}
      />

      {/* 4. Nội Dung Tab 1: Cấu hình Giai đoạn Phễu */}
      {activeTab === 'stages' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột trái: Danh sách stages hiện tại */}
          <div className="lg:col-span-2 space-y-4">
            {/* Live Preview Mini */}
            <div className="p-3 bg-slate-50 border border-slate-200">
              <div className="text-xs font-semibold text-slate-600 mb-2">
                Dòng chảy Phễu trực quan ({config.pipelineStages.length} giai đoạn):
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {config.pipelineStages.map((s, idx) => (
                  <div
                    key={s.id}
                    className="px-2 py-1 text-xs font-semibold whitespace-nowrap flex items-center gap-1 border"
                    style={{
                      backgroundColor: s.bgColor,
                      borderColor: s.borderColor,
                      color: s.color,
                    }}
                  >
                    <span>{idx + 1}. {s.name}</span>
                    {s.isWon && <span className="text-emerald-600">★</span>}
                    {s.isLost && <span className="text-slate-400">✕</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* List Stages */}
            <div className="space-y-2">
              {config.pipelineStages.map((stage, index) => {
                const isEditing = editingStageId === stage.id;

                if (isEditing) {
                  return (
                    <div
                      key={stage.id}
                      className="p-4 bg-white border-2 border-blue-600 space-y-3"
                    >
                      <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                        Chỉnh sửa giai đoạn: {stage.name}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Tên giai đoạn *
                          </label>
                          <input
                            type="text"
                            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600"
                            value={editStageName}
                            onChange={(e) => setEditStageName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Mô tả phụ đề
                          </label>
                          <input
                            type="text"
                            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600"
                            value={editStageSubtitle}
                            onChange={(e) => setEditStageSubtitle(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Chọn màu */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Màu sắc nhận diện
                        </label>
                        <div className="flex gap-1.5">
                          {COLOR_SWATCHES.map((swatch) => (
                            <button
                              key={swatch.color}
                              type="button"
                              onClick={() => setEditStageColor(swatch)}
                              className={`w-6 h-6 border ${
                                editStageColor.color === swatch.color ? 'border-slate-900 ring-2 ring-slate-900/20' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: swatch.color }}
                              title={swatch.name}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleSaveEditStage(stage.id)}
                          icon={<Check size={14} />}
                        >
                          Lưu giai đoạn
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingStageId(null)}
                          icon={<X size={14} />}
                        >
                          Hủy
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={stage.id}
                    className="flex items-center justify-between p-3.5 bg-white border border-slate-200"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3.5 h-3.5 shrink-0 border"
                        style={{ backgroundColor: stage.color, borderColor: stage.borderColor }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {index + 1}. {stage.name}
                          </span>
                          {stage.isWon && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Chốt thành công
                            </span>
                          )}
                          {stage.isLost && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
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
                          onClick={() => reorderStages(index, index - 1)}
                          title="Di chuyển lên"
                          className="p-1.5 text-slate-500 hover:text-slate-900 border border-transparent hover:border-slate-200 bg-transparent disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={index === config.pipelineStages.length - 1}
                          onClick={() => reorderStages(index, index + 1)}
                          title="Di chuyển xuống"
                          className="p-1.5 text-slate-500 hover:text-slate-900 border border-transparent hover:border-slate-200 bg-transparent disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditStage(stage)}
                          title="Sửa giai đoạn"
                          className="p-1.5 text-slate-500 hover:text-blue-600 border border-transparent hover:border-slate-200 bg-transparent cursor-pointer"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteStage(stage.id)}
                          title="Xóa giai đoạn"
                          className="p-1.5 text-slate-500 hover:text-red-600 border border-transparent hover:border-slate-200 bg-transparent cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cột phải: Form Thêm giai đoạn mới */}
          <div>
            <div className="p-4 bg-white border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Plus size={16} className="text-blue-600" />
                <h4 className="m-0 text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Thêm Giai Đoạn Mới
                </h4>
              </div>

              <form onSubmit={handleCreateStage} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên giai đoạn *
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Hẹn phỏng vấn trực tiếp"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    disabled={!isOwner}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600 box-border disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mô tả / Phụ đề
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Khách đã xác nhận lịch gặp"
                    value={newStageSubtitle}
                    onChange={(e) => setNewStageSubtitle(e.target.value)}
                    disabled={!isOwner}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600 box-border disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Màu sắc nhận diện
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {COLOR_SWATCHES.map((swatch) => (
                      <button
                        key={swatch.color}
                        type="button"
                        onClick={() => isOwner && setNewStageColor(swatch)}
                        className={`w-6 h-6 border ${
                          newStageColor.color === swatch.color ? 'border-slate-900 ring-2 ring-slate-900/20' : 'border-transparent'
                        } ${isOwner ? 'cursor-pointer' : 'cursor-default'}`}
                        style={{ backgroundColor: swatch.color }}
                        title={swatch.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStageIsWon}
                      onChange={(e) => {
                        setNewStageIsWon(e.target.checked);
                        if (e.target.checked) setNewStageIsLost(false);
                      }}
                      disabled={!isOwner}
                    />
                    <span>Đánh dấu là giai đoạn Chốt thành công</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStageIsLost}
                      onChange={(e) => {
                        setNewStageIsLost(e.target.checked);
                        if (e.target.checked) setNewStageIsWon(false);
                      }}
                      disabled={!isOwner}
                    />
                    <span>Đánh dấu là giai đoạn Thất bại / Hủy</span>
                  </label>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center"
                  disabled={!isOwner || isLoading}
                  icon={<Plus size={14} />}
                >
                  Thêm Vào Phễu
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 5. Nội Dung Tab 2: Danh Mục Sản Phẩm / Khóa Học */}
      {activeTab === 'catalog' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột trái: Bảng danh mục sản phẩm */}
          <div className="lg:col-span-2">
            <div className="border border-slate-200 bg-white">
              <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h4 className="m-0 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Danh Sách {config.terminology.productLabel} Hiện Tại ({config.productCatalog.length})
                </h4>
              </div>

              {config.productCatalog.length === 0 ? (
                <EmptyState
                  title={`Chưa có ${config.terminology.productLabel.toLowerCase()} nào`}
                  description="Hãy thêm sản phẩm hoặc khóa học mới từ biểu mẫu bên phải."
                />
              ) : (
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-semibold">
                      <th className="p-3">Tên mục</th>
                      <th className="p-3">Mã định danh</th>
                      <th className="p-3">Nhóm / Danh mục</th>
                      <th className="p-3 text-right">Giá niêm yết</th>
                      {isOwner && <th className="p-3 text-center w-16">Xóa</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {config.productCatalog.map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50/60">
                        <td className="p-3 font-semibold text-slate-900">
                          {prod.name}
                          {prod.description && (
                            <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                              {prod.description}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 font-mono text-[11px]">
                          {prod.code || '—'}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200">
                            {prod.category}
                          </span>
                        </td>
                        <td className="p-3 text-right font-semibold text-blue-600 font-mono">
                          {new Intl.NumberFormat('vi-VN').format(prod.defaultPrice)} đ
                        </td>
                        {isOwner && (
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => deleteProduct(prod.id)}
                              title="Xóa mục"
                              className="p-1 text-slate-400 hover:text-red-600 border-none bg-transparent cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Cột phải: Form Thêm Sản Phẩm Mới */}
          <div>
            <div className="p-4 bg-white border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Plus size={16} className="text-blue-600" />
                <h4 className="m-0 text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Thêm {config.terminology.productLabel} Mới
                </h4>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên gọi *
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Khóa học Lập trình AI"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    disabled={!isOwner}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600 box-border disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã định danh (Code)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: AI-ADV-01"
                    value={newProdCode}
                    onChange={(e) => setNewProdCode(e.target.value)}
                    disabled={!isOwner}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600 box-border disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nhóm / Danh mục
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Ngắn hạn, Cao cấp, Dài hạn"
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    disabled={!isOwner}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600 box-border disabled:bg-slate-50"
                  />
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
                    disabled={!isOwner}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600 box-border disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mô tả ngắn
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Mô tả thông tin quyền lợi gói..."
                    value={newProdDesc}
                    onChange={(e) => setNewProdDesc(e.target.value)}
                    disabled={!isOwner}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600 box-border disabled:bg-slate-50 resize-y"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center"
                  disabled={!isOwner || isLoading}
                  icon={<Plus size={14} />}
                >
                  Thêm Vào Danh Mục
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 6. Nội Dung Tab 3: Thuật Ngữ Hệ Thống */}
      {activeTab === 'terminology' && (
        <div className="max-w-2xl">
          <div className="p-6 bg-white border border-slate-200 space-y-5">
            <div>
              <h4 className="m-0 text-sm font-bold text-slate-900">
                Cấu Hình Nhãn Thuật Ngữ Hiển Thị Trên Giao Diện
              </h4>
              <p className="text-xs text-slate-500 mt-1 mb-0">
                Các tên gọi này sẽ tự động thay đổi theo toàn bộ hệ thống quản lý phễu và thông tin khách hàng.
              </p>
            </div>

            <form onSubmit={handleSaveTerminology} className="space-y-4">
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
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600 box-border disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên gọi của Bảng Phễu (Bảng Kanban)
                </label>
                <input
                  type="text"
                  placeholder="VD: Phễu Tuyển Sinh CUSC, Phễu Đào Tạo Lập Trình"
                  value={pipelineNameInput}
                  onChange={(e) => setPipelineNameInput(e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600 box-border disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên gọi danh mục quan tâm
                </label>
                <input
                  type="text"
                  placeholder="VD: Khóa học quan tâm, Dự án quan tâm, Gói liệu trình"
                  value={productLabelInput}
                  onChange={(e) => setProductLabelInput(e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600 box-border disabled:bg-slate-50"
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
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600 box-border disabled:bg-slate-50"
                />
              </div>

              {isOwner && (
                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isLoading}
                    icon={<Save size={14} />}
                  >
                    Lưu Cấu Hình Thuật Ngữ
                  </Button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* 7. Tab Tiêu Chí Đánh Giá / Phân Loại */}
      {activeTab === 'criteria' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột trái: Danh sách tiêu chí */}
          <div className="lg:col-span-2 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 m-0 mb-1">
                Tiêu Chí Đánh Giá & Phân Loại ({config.criteria.length})
              </h3>
              <p className="text-xs text-slate-500 m-0">
                Các câu hỏi, tiêu chuẩn sàng lọc ứng viên/khách hàng được lưu vào cơ sở dữ liệu theo tài khoản Chủ doanh nghiệp.
              </p>
            </div>

            {config.criteria.length === 0 ? (
              <EmptyState
                title="Chưa có tiêu chí đánh giá nào"
                description="Hãy thêm tiêu chí mới ở biểu mẫu bên phải để phân loại khách hàng chính xác."
              />
            ) : (
              <div className="space-y-2">
                {config.criteria.map((crit) => (
                  <div
                    key={crit.id}
                    className="flex items-center justify-between p-3.5 bg-white border border-slate-200"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-900">
                          {crit.name}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {crit.type}
                        </span>
                        {crit.isRequired && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
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
                        onClick={() => deleteCriteria(crit.id)}
                        title="Xóa tiêu chí"
                        className="p-1.5 text-slate-400 hover:text-red-600 border-none bg-transparent cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cột phải: Form thêm tiêu chí */}
          <div>
            <div className="p-4 bg-white border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Plus size={16} className="text-blue-600" />
                <h4 className="m-0 text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Thêm Tiêu Chí Mới
                </h4>
              </div>

              <form onSubmit={handleCreateCriteria} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên tiêu chí *
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Trình độ học vấn, Tầm tài chính..."
                    value={newCritName}
                    onChange={(e) => setNewCritName(e.target.value)}
                    disabled={!isOwner}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600 box-border disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kiểu dữ liệu
                  </label>
                  <select
                    value={newCritType}
                    onChange={(e) => setNewCritType(e.target.value as any)}
                    disabled={!isOwner}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none bg-white text-slate-700 outline-none focus:border-blue-600 cursor-pointer box-border disabled:bg-slate-50"
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
                      disabled={!isOwner}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600 box-border disabled:bg-slate-50"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <input
                    type="checkbox"
                    id="critRequired"
                    checked={newCritRequired}
                    onChange={(e) => setNewCritRequired(e.target.checked)}
                    disabled={!isOwner}
                  />
                  <label htmlFor="critRequired" className="text-xs text-slate-700 cursor-pointer">
                    Tiêu chuẩn bắt buộc phải thu thập
                  </label>
                </div>

                {isOwner && (
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full justify-center"
                    disabled={isLoading}
                    icon={<Plus size={14} />}
                  >
                    Thêm Tiêu Chí
                  </Button>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
