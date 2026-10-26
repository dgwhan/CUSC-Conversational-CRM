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
  Users,
  Lock,
  Unlock,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import { useWorkspaceConfig } from '../WorkspaceConfigContext.js';
import { useUserRole } from '../../auth/UserRoleContext.js';
import type { BusinessDomain, PipelineStageConfig } from '../workspaceConfig.types.js';
import { notify } from '../../../components/feedback/toastEmitter.js';

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
    staffMembers,
    createStaffMember,
    updateStaffMember,
    toggleLockStaffMember,
    deleteStaffMember,
    resetToDefault,
  } = useWorkspaceConfig();

  const { isOwner, staffId } = useUserRole();

  const [activeTab, setActiveTab] = useState<'stages' | 'catalog' | 'terminology' | 'criteria' | 'staff'>('stages');

  // Form nhân sự mới
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'STAFF' | 'OWNER'>('STAFF');

  // Form sửa nhân sự
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editStaffFullName, setEditStaffFullName] = useState('');
  const [editStaffPassword, setEditStaffPassword] = useState('');
  const [editStaffRole, setEditStaffRole] = useState<'STAFF' | 'OWNER'>('STAFF');

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

  // Form thuật ngữ
  const [workspaceNameInput, setWorkspaceNameInput] = useState(config.workspaceName);
  const [entityNameInput, setEntityNameInput] = useState(config.terminology.entityName);
  const [pipelineNameInput, setPipelineNameInput] = useState(config.terminology.pipelineName);
  const [productLabelInput, setProductLabelInput] = useState(config.terminology.productLabel);
  const [valueLabelInput, setValueLabelInput] = useState(config.terminology.valueLabel);

  const presetsList: { key: BusinessDomain; title: string; subtitle: string; icon: React.ReactNode }[] = [
    {
      key: 'EDUCATION',
      title: 'Giáo Dục & Tuyển Sinh (PolarisX)',
      subtitle: 'Khóa học Aptech, Fullstack, Arena, Python AI; Thí sinh & Học phí',
      icon: <GraduationCap size={20} color="#0284c7" />,
    },
    {
      key: 'REAL_ESTATE',
      title: 'Bất Động Sản & Dự Án',
      subtitle: 'Căn hộ, Biệt thự, Đất nền; Hẹn xem nhà mẫu & Đặt cọc',
      icon: <Building2 size={20} color="#ea580c" />,
    },
    {
      key: 'BEAUTY_SPA',
      title: 'Thẩm Mỹ Viện & Spa',
      subtitle: 'Phác đồ soi da, Liệu trình trị nám, Đặt lịch hẹn cơ sở',
      icon: <Sparkles size={20} color="#ec4899" />,
    },
    {
      key: 'B2B_SAAS',
      title: 'B2B SaaS & Phần Mềm',
      subtitle: 'Phần mềm CRM, Cloud, Gói giải pháp; Lịch Demo & Hợp đồng ARR',
      icon: <Server size={20} color="#6366f1" />,
    },
    {
      key: 'RETAIL',
      title: 'Bán Lẻ & Thương Mại Online',
      subtitle: 'Sản phẩm thời trang, Đơn COD, Vận chuyển & Giao hàng chốt đơn',
      icon: <ShoppingBag size={20} color="#16a34a" />,
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
      workspaceName: workspaceNameInput.trim() || config.workspaceName,
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

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail.trim() || !newStaffName.trim()) {
      notify.warning('Vui lòng nhập Email và Họ tên nhân viên.');
      return;
    }

    try {
      await createStaffMember({
        email: newStaffEmail.trim(),
        fullName: newStaffName.trim(),
        password: newStaffPassword.trim() || undefined,
        role: newStaffRole,
      });

      setNewStaffEmail('');
      setNewStaffName('');
      setNewStaffPassword('');
      setNewStaffRole('STAFF');
    } catch {}
  };

  const startEditStaff = (staff: any) => {
    setEditingStaffId(staff.id);
    setEditStaffFullName(staff.fullName);
    setEditStaffPassword('');
    setEditStaffRole(staff.role as any);
  };

  const handleUpdateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaffId) return;

    try {
      await updateStaffMember(editingStaffId, {
        fullName: editStaffFullName.trim(),
        password: editStaffPassword.trim() || undefined,
        role: editStaffRole,
      });

      setEditingStaffId(null);
    } catch {}
  };

  return (
    <div className="crm-workspace-settings-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 1. Header Cấu Hình */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={24} color="#0284c7" />
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Cấu Hình Đa Doanh Nghiệp (Multi-Tenant Workspace)
            </h1>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
            Tùy biến tiêu chí phễu bán hàng/tuyển sinh, danh mục sản phẩm, khóa học và thuật ngữ theo từng mô hình kinh doanh.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isOwner && (
            <button
              type="button"
              className="crm-btn crm-btn-secondary crm-btn-sm"
              onClick={resetToDefault}
              title="Khôi phục về cấu hình mẫu PolarisX ban đầu"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={14} />
              <span>Mặc định PolarisX</span>
            </button>
          )}
          <span
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: isOwner ? '#f0fdf4' : '#fff7ed',
              color: isOwner ? '#16a34a' : '#c2410c',
              border: `1px solid ${isOwner ? '#bbf7d0' : '#fed7aa'}`,
            }}
          >
            {isOwner ? '👑 Quyền: Chủ Doanh Nghiệp (Owner)' : '🎧 Quyền: Tư Vấn Viên (Chỉ Đọc)'}
          </span>
        </div>
      </div>

      {/* Cảnh báo nếu là Agent */}
      {!isOwner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            backgroundColor: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: '8px',
            marginBottom: '20px',
            color: '#9a3412',
            fontSize: '13px',
          }}
        >
          <ShieldAlert size={18} />
          <span>
            Bạn đang đăng nhập với vai trò <strong>Tư vấn viên (Agent)</strong>. Giao diện đang ở chế độ xem; chỉ Chủ doanh nghiệp mới có quyền lưu thay đổi hoặc chuyển đổi mô hình ngành nghề.
          </span>
        </div>
      )}

      {/* 2. Bộ Mẫu Ngành Nghề Nhanh (1-Click Industry Presets) */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '18px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Palette size={18} color="#0284c7" />
          <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: '#1e293b' }}>
            Chuyển Đổi Nhanh Theo Ngành Nghề (Industry Quick Presets)
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
          {presetsList.map((preset) => {
            const isActive = config.domain === preset.key;
            return (
              <div
                key={preset.key}
                onClick={() => isOwner && applyPreset(preset.key)}
                style={{
                  border: `2px solid ${isActive ? '#0284c7' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  padding: '14px',
                  cursor: isOwner ? 'pointer' : 'default',
                  backgroundColor: isActive ? '#f0f9ff' : '#ffffff',
                  transition: 'all 0.2s',
                  position: 'relative',
                  opacity: !isOwner && !isActive ? 0.7 : 1,
                }}
              >
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '10px',
                    }}
                  >
                    Đang dùng
                  </span>
                )}
                <div style={{ marginBottom: '8px' }}>{preset.icon}</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                  {preset.title}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                  {preset.subtitle}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Thanh Chuyển Tab */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('stages')}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'stages' ? '2px solid #0284c7' : '2px solid transparent',
            marginBottom: '-2px',
            backgroundColor: 'transparent',
            color: activeTab === 'stages' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Layers size={16} />
          <span>Giai Đoạn Phễu ({config.pipelineStages.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'catalog' ? '2px solid #0284c7' : '2px solid transparent',
            marginBottom: '-2px',
            backgroundColor: 'transparent',
            color: activeTab === 'catalog' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <BookOpen size={16} />
          <span>{config.terminology.productLabel} ({config.productCatalog.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('terminology')}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'terminology' ? '2px solid #0284c7' : '2px solid transparent',
            marginBottom: '-2px',
            backgroundColor: 'transparent',
            color: activeTab === 'terminology' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Tag size={16} />
          <span>Thuật Ngữ Hệ Thống</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('criteria')}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'criteria' ? '2px solid #0284c7' : '2px solid transparent',
            marginBottom: '-2px',
            backgroundColor: 'transparent',
            color: activeTab === 'criteria' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sliders size={16} />
          <span>Tiêu Chí Phân Loại ({config.criteria.length})</span>
        </button>

        {isOwner && (
          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            style={{
              padding: '10px 18px',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              borderBottom: activeTab === 'staff' ? '2px solid #0284c7' : '2px solid transparent',
              marginBottom: '-2px',
              backgroundColor: 'transparent',
              color: activeTab === 'staff' ? '#0284c7' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Users size={16} />
            <span>Quản Lý Nhân Viên ({staffMembers.length})</span>
          </button>
        )}
      </div>

      {/* 4. Nội Dung Tab 1: Cấu hình Giai đoạn Phễu */}
      {activeTab === 'stages' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
          {/* Cột trái: Danh sách stages hiện tại */}
          <div>
            {/* Live Preview Mini */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                Dòng chảy Phễu Trực Quan (Pipeline Flow Preview):
              </div>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                {config.pipelineStages.map((s, idx) => (
                  <div
                    key={s.id}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: s.bgColor,
                      border: `1px solid ${s.borderColor}`,
                      color: s.color,
                      fontSize: '11px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>{idx + 1}. {s.name}</span>
                    {s.isWon && <span style={{ color: '#16a34a' }}>★</span>}
                    {s.isLost && <span style={{ color: '#64748b' }}>✕</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* List Stages */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {config.pipelineStages.map((stage, index) => {
                const isEditing = editingStageId === stage.id;

                if (isEditing) {
                  return (
                    <div
                      key={stage.id}
                      style={{
                        padding: '14px',
                        backgroundColor: '#ffffff',
                        border: '2px solid #0284c7',
                        borderRadius: '8px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '10px', color: '#0284c7' }}>
                        Chỉnh sửa giai đoạn:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            Tên giai đoạn *
                          </label>
                          <input
                            type="text"
                            className="crm-form-input"
                            value={editStageName}
                            onChange={(e) => setEditStageName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            Mô tả phụ đề
                          </label>
                          <input
                            type="text"
                            className="crm-form-input"
                            value={editStageSubtitle}
                            onChange={(e) => setEditStageSubtitle(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Chọn màu */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                          Màu sắc nhận diện
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {COLOR_SWATCHES.map((swatch) => (
                            <div
                              key={swatch.color}
                              onClick={() => setEditStageColor(swatch)}
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                backgroundColor: swatch.color,
                                cursor: 'pointer',
                                border: editStageColor.color === swatch.color ? '2px solid #000' : '2px solid transparent',
                              }}
                              title={swatch.name}
                            />
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="button"
                          className="crm-btn crm-btn-secondary crm-btn-sm"
                          onClick={() => setEditingStageId(null)}
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          className="crm-btn crm-btn-primary crm-btn-sm"
                          onClick={() => handleSaveEditStage(stage.id)}
                        >
                          <Check size={14} />
                          <span>Lưu thay đổi</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={stage.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: '#ffffff',
                      border: `1px solid ${stage.borderColor || '#e2e8f0'}`,
                      borderRadius: '8px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          backgroundColor: stage.color,
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                            {stage.name}
                          </span>
                          {stage.isWon && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '10px',
                                backgroundColor: '#dcfce7',
                                color: '#15803d',
                                fontWeight: 700,
                              }}
                            >
                              ✓ Chốt thành công
                            </span>
                          )}
                          {stage.isLost && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '10px',
                                backgroundColor: '#f1f5f9',
                                color: '#475569',
                                fontWeight: 600,
                              }}
                            >
                              ✕ Thất bại/Hủy
                            </span>
                          )}
                        </div>
                        {stage.subtitle && (
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {stage.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Nút hành động */}
                    {isOwner && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          disabled={index === 0}
                          onClick={() => reorderStages(index, index - 1)}
                          title="Di chuyển lên"
                          style={{ opacity: index === 0 ? 0.3 : 1, padding: '4px', cursor: 'pointer' }}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          disabled={index === config.pipelineStages.length - 1}
                          onClick={() => reorderStages(index, index + 1)}
                          title="Di chuyển xuống"
                          style={{
                            opacity: index === config.pipelineStages.length - 1 ? 0.3 : 1,
                            padding: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => startEditStage(stage)}
                          title="Sửa giai đoạn"
                          style={{ padding: '4px', cursor: 'pointer' }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => deleteStage(stage.id)}
                          title="Xóa giai đoạn"
                          style={{ padding: '4px', color: '#dc2626', cursor: 'pointer' }}
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
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                <Plus size={16} color="#0284c7" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                  Thêm Giai Đoạn Mới
                </h4>
              </div>

              <form onSubmit={handleCreateStage}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Tên giai đoạn *
                  </label>
                  <input
                    type="text"
                    className="crm-form-input"
                    placeholder="VD: Hẹn phỏng vấn trực tiếp"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    disabled={!isOwner}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Mô tả / Phụ đề
                  </label>
                  <input
                    type="text"
                    className="crm-form-input"
                    placeholder="VD: Khách đã xác nhận lịch gặp"
                    value={newStageSubtitle}
                    onChange={(e) => setNewStageSubtitle(e.target.value)}
                    disabled={!isOwner}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Màu sắc nhận diện
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {COLOR_SWATCHES.map((swatch) => (
                      <div
                        key={swatch.color}
                        onClick={() => isOwner && setNewStageColor(swatch)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: swatch.color,
                          cursor: isOwner ? 'pointer' : 'default',
                          border: newStageColor.color === swatch.color ? '2px solid #000' : '2px solid transparent',
                        }}
                        title={swatch.name}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
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

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
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

                <button
                  type="submit"
                  className="crm-btn crm-btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={!isOwner || isLoading}
                >
                  <Plus size={15} />
                  <span>Thêm Vào Phễu</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 5. Nội Dung Tab 2: Danh Mục Sản Phẩm / Khóa Học */}
      {activeTab === 'catalog' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
          {/* Cột trái: Bảng danh mục sản phẩm */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                Danh Sách {config.terminology.productLabel} Hiện Tại
              </h4>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fdfdfd', color: '#64748b' }}>
                  <th style={{ padding: '10px 16px' }}>Tên mục</th>
                  <th style={{ padding: '10px 16px' }}>Mã / Code</th>
                  <th style={{ padding: '10px 16px' }}>Nhóm</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Giá niêm yết</th>
                  {isOwner && <th style={{ padding: '10px 16px', textAlign: 'center' }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {config.productCatalog.map((prod) => (
                  <tr key={prod.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                      {prod.name}
                      {prod.description && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400, marginTop: '2px' }}>
                          {prod.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                      {prod.code || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#f1f5f9',
                          fontSize: '11px',
                          color: '#475569',
                        }}
                      >
                        {prod.category}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#0284c7' }}>
                      {new Intl.NumberFormat('vi-VN').format(prod.defaultPrice)} đ
                    </td>
                    {isOwner && (
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => deleteProduct(prod.id)}
                          title="Xóa mục"
                          style={{ color: '#dc2626', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cột phải: Form Thêm Sản Phẩm Mới */}
          <div>
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                <Plus size={16} color="#0284c7" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                  Thêm {config.terminology.productLabel} Mới
                </h4>
              </div>

              <form onSubmit={handleCreateProduct}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Tên gọi *
                  </label>
                  <input
                    type="text"
                    className="crm-form-input"
                    placeholder="VD: Căn hộ 3PN hoặc Khóa học AI"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    disabled={!isOwner}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Mã định danh (Code)
                  </label>
                  <input
                    type="text"
                    className="crm-form-input"
                    placeholder="VD: AI-ADV-01"
                    value={newProdCode}
                    onChange={(e) => setNewProdCode(e.target.value)}
                    disabled={!isOwner}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Nhóm / Danh mục
                  </label>
                  <input
                    type="text"
                    className="crm-form-input"
                    placeholder="VD: Ngắn hạn, Cao cấp, Dài hạn"
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    disabled={!isOwner}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Giá niêm yết mặc định (VNĐ)
                  </label>
                  <input
                    type="number"
                    step="100000"
                    className="crm-form-input"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    disabled={!isOwner}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Mô tả ngắn
                  </label>
                  <textarea
                    className="crm-form-textarea"
                    rows={2}
                    placeholder="Mô tả thông tin quyền lợi gói..."
                    value={newProdDesc}
                    onChange={(e) => setNewProdDesc(e.target.value)}
                    disabled={!isOwner}
                  />
                </div>

                <button
                  type="submit"
                  className="crm-btn crm-btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={!isOwner || isLoading}
                >
                  <Plus size={15} />
                  <span>Thêm Vào Danh Mục</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 6. Nội Dung Tab 3: Thuật Ngữ & Tiêu Chí Đánh Giá */}
      {activeTab === 'terminology' && (
        <div style={{ maxWidth: '640px' }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
              Cấu Hình Nhãn Thuật Ngữ Hiển Thị Trên Giao Diện
            </h4>

            <form onSubmit={handleSaveTerminology}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Tên Doanh Nghiệp / Cơ Sở Đào Tạo (Workspace Name)
                </label>
                <input
                  type="text"
                  className="crm-form-input"
                  value={workspaceNameInput}
                  onChange={(e) => setWorkspaceNameInput(e.target.value)}
                  disabled={!isOwner}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Tên thực thể khách hàng (Hiển thị tại Cột Hồ Sơ & Modal)
                </label>
                <input
                  type="text"
                  className="crm-form-input"
                  placeholder="VD: Thí sinh / Học viên, Khách mua BĐS, Khách hàng"
                  value={entityNameInput}
                  onChange={(e) => setEntityNameInput(e.target.value)}
                  disabled={!isOwner}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Tên gọi của Bảng Phễu (Bảng Kanban)
                </label>
                <input
                  type="text"
                  className="crm-form-input"
                  placeholder="VD: Phễu Tuyển Sinh PolarisX, Phễu Chốt Cọc Bất Động Sản"
                  value={pipelineNameInput}
                  onChange={(e) => setPipelineNameInput(e.target.value)}
                  disabled={!isOwner}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Tên gọi danh mục quan tâm
                </label>
                <input
                  type="text"
                  className="crm-form-input"
                  placeholder="VD: Khóa học quan tâm, Dự án quan tâm, Gói liệu trình"
                  value={productLabelInput}
                  onChange={(e) => setProductLabelInput(e.target.value)}
                  disabled={!isOwner}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Tên gọi Doanh số / Học phí dự kiến
                </label>
                <input
                  type="text"
                  className="crm-form-input"
                  placeholder="VD: Học phí dự kiến (VNĐ), Giá trị đơn hàng, Giá trị giao dịch"
                  value={valueLabelInput}
                  onChange={(e) => setValueLabelInput(e.target.value)}
                  disabled={!isOwner}
                />
              </div>

              {isOwner && (
                <button
                  type="submit"
                  className="crm-btn crm-btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  disabled={isLoading}
                >
                  <Save size={15} />
                  <span>Lưu Cấu Hình Thuật Ngữ</span>
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* 7. Tab Tiêu Chí Đánh Giá / Phân Loại */}
      {activeTab === 'criteria' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: '24px' }}>
          {/* Cột trái: Danh sách tiêu chí */}
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>
                Tiêu Chí Đánh Giá & Phân Loại ({config.criteria.length})
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Các câu hỏi, tiêu chuẩn sàng lọc ứng viên/khách hàng được lưu vào cơ sở dữ liệu theo tài khoản Chủ doanh nghiệp.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {config.criteria.length === 0 ? (
                <div
                  style={{
                    padding: '32px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1',
                    color: '#64748b',
                    fontSize: '13px',
                  }}
                >
                  Chưa có tiêu chí đánh giá nào. Hãy thêm tiêu chí mới ở biểu mẫu bên phải.
                </div>
              ) : (
                config.criteria.map((crit) => (
                  <div
                    key={crit.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      background: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                          {crit.name}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                          }}
                        >
                          {crit.type}
                        </span>
                        {crit.isRequired && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: '#fef2f2',
                              color: '#dc2626',
                            }}
                          >
                            Bắt buộc
                          </span>
                        )}
                      </div>
                      {crit.options && crit.options.length > 0 && (
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          Tùy chọn: {crit.options.join(', ')}
                        </div>
                      )}
                    </div>

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => deleteCriteria(crit.id)}
                        className="crm-btn-icon danger"
                        title="Xóa tiêu chí"
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cột phải: Form thêm tiêu chí */}
          <div>
            <div
              style={{
                background: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '20px',
              }}
            >
              <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px', color: '#0f172a' }}>
                Thêm Tiêu Chí Mới
              </h4>
              <form onSubmit={handleCreateCriteria}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Tên tiêu chí *
                  </label>
                  <input
                    type="text"
                    className="crm-form-input"
                    placeholder="VD: Trình độ học vấn, Tầm tài chính..."
                    value={newCritName}
                    onChange={(e) => setNewCritName(e.target.value)}
                    disabled={!isOwner}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Kiểu dữ liệu
                  </label>
                  <select
                    className="crm-form-select"
                    value={newCritType}
                    onChange={(e) => setNewCritType(e.target.value as any)}
                    disabled={!isOwner}
                  >
                    <option value="TEXT">Văn bản (Text)</option>
                    <option value="SELECT">Chọn một (Dropdown Select)</option>
                    <option value="NUMBER">Số liệu (Number)</option>
                    <option value="BOOLEAN">Có / Không (Boolean)</option>
                  </select>
                </div>

                {newCritType === 'SELECT' && (
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Các tùy chọn (phân cách bằng dấu phẩy)
                    </label>
                    <input
                      type="text"
                      className="crm-form-input"
                      placeholder="VD: THPT, Trung cấp, Đại học, Đi làm"
                      value={newCritOptions}
                      onChange={(e) => setNewCritOptions(e.target.value)}
                      disabled={!isOwner}
                    />
                  </div>
                )}

                <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="critRequired"
                    checked={newCritRequired}
                    onChange={(e) => setNewCritRequired(e.target.checked)}
                    disabled={!isOwner}
                  />
                  <label htmlFor="critRequired" style={{ fontSize: '13px', cursor: 'pointer' }}>
                    Tiêu chuẩn bắt buộc phải thu thập
                  </label>
                </div>

                {isOwner && (
                  <button
                    type="submit"
                    className="crm-btn crm-btn-primary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    disabled={isLoading}
                  >
                    <Plus size={16} />
                    <span>Thêm Tiêu Chí</span>
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 8. Tab Quản Lý Nhân Sự (Staff Management) */}
      {activeTab === 'staff' && isOwner && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: '24px' }}>
          {/* Cột trái: Danh sách nhân viên */}
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>
                Danh Sách Nhân Viên & Tư Vấn Viên ({staffMembers.length})
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Ràng buộc đa người dùng: Nhân viên tạo bởi Owner này sẽ chỉ xem được dữ liệu phễu và khách hàng của Workspace này. Chủ doanh nghiệp có quyền sửa thông tin, đặt lại mật khẩu, khóa hoặc xóa tài khoản.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {staffMembers.length === 0 ? (
                <div
                  style={{
                    padding: '32px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1',
                    color: '#64748b',
                    fontSize: '13px',
                  }}
                >
                  Chưa có nhân viên nào trực thuộc. Hãy thêm nhân viên mới ở biểu mẫu bên phải.
                </div>
              ) : (
                staffMembers.map((st) => {
                  const isCurrentOwnerSelf = st.id === staffId;
                  const isLocked = st.status === 'LOCKED';
                  return (
                    <div
                      key={st.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 18px',
                        background: '#ffffff',
                        borderRadius: '8px',
                        border: isLocked ? '1px solid #fecaca' : '1px solid #e2e8f0',
                        backgroundColor: isLocked ? '#fff5f5' : '#ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: st.role === 'OWNER' ? '#eff6ff' : '#f1f5f9',
                            color: st.role === 'OWNER' ? '#1d4ed8' : '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '14px',
                          }}
                        >
                          {st.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                              {st.fullName} {isCurrentOwnerSelf ? '(Bạn)' : ''}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: st.role === 'OWNER' ? '#eff6ff' : '#f8fafc',
                                color: st.role === 'OWNER' ? '#1d4ed8' : '#64748b',
                                border: '1px solid #cbd5e1',
                              }}
                            >
                              {st.role === 'OWNER' ? 'Chủ doanh nghiệp' : 'Tư vấn viên'}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: isLocked ? '#fef2f2' : '#f0fdf4',
                                color: isLocked ? '#dc2626' : '#16a34a',
                                border: `1px solid ${isLocked ? '#fca5a5' : '#bbf7d0'}`,
                              }}
                            >
                              {isLocked ? 'Đã khóa' : 'Đang hoạt động'}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            {st.email}
                          </div>
                        </div>
                      </div>

                      {/* Các nút hành động: Khóa / Sửa / Xóa */}
                      {!isCurrentOwnerSelf && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => toggleLockStaffMember(st.id, !isLocked)}
                            title={isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản nhân viên này'}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 10px',
                              fontSize: '12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: isLocked ? '#f0fdf4' : '#fff1f2',
                              color: isLocked ? '#16a34a' : '#e11d48',
                              cursor: 'pointer',
                            }}
                          >
                            {isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                            <span>{isLocked ? 'Mở khóa' : 'Khóa'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => startEditStaff(st)}
                            title="Sửa thông tin hoặc đặt lại mật khẩu"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 10px',
                              fontSize: '12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            <Edit2 size={14} />
                            <span>Sửa</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Bạn có chắc muốn xóa nhân viên "${st.fullName}" khỏi hệ thống?`)) {
                                deleteStaffMember(st.id);
                              }
                            }}
                            title="Xóa nhân viên"
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid #fee2e2',
                              background: '#fff',
                              color: '#ef4444',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cột phải: Form thêm / sửa nhân viên */}
          <div>
            <div
              style={{
                background: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '20px',
              }}
            >
              {editingStaffId ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                      Cập Nhật Nhân Viên
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingStaffId(null)}
                      style={{ border: 'none', background: 'transparent', fontSize: '12px', color: '#64748b', cursor: 'pointer' }}
                    >
                      Hủy bỏ
                    </button>
                  </div>
                  <form onSubmit={handleUpdateStaffSubmit}>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        Họ và tên *
                      </label>
                      <input
                        type="text"
                        className="crm-form-input"
                        value={editStaffFullName}
                        onChange={(e) => setEditStaffFullName(e.target.value)}
                        required
                      />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        Đặt lại mật khẩu mới (Bỏ trống nếu giữ nguyên)
                      </label>
                      <input
                        type="password"
                        className="crm-form-input"
                        placeholder="Nhập mật khẩu mới..."
                        value={editStaffPassword}
                        onChange={(e) => setEditStaffPassword(e.target.value)}
                      />
                    </div>

                    <div style={{ marginBottom: '18px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        Vai trò
                      </label>
                      <select
                        className="crm-form-select"
                        value={editStaffRole}
                        onChange={(e) => setEditStaffRole(e.target.value as any)}
                      >
                        <option value="STAFF">Tư vấn viên (Staff/Agent)</option>
                        <option value="OWNER">Đồng sở hữu (Owner)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="crm-btn crm-btn-primary"
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <Check size={16} />
                      <span>Lưu Thay Đổi</span>
                    </button>
                  </form>
                </div>
              ) : (
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px', color: '#0f172a' }}>
                    Thêm Nhân Viên Tư Vấn
                  </h4>
                  <form onSubmit={handleCreateStaff}>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        Email đăng nhập *
                      </label>
                      <input
                        type="email"
                        className="crm-form-input"
                        placeholder="VD: tuvanvien1@polarisx.com"
                        value={newStaffEmail}
                        onChange={(e) => setNewStaffEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        Họ và tên *
                      </label>
                      <input
                        type="text"
                        className="crm-form-input"
                        placeholder="VD: Nguyễn Văn Nam"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        required
                      />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        Mật khẩu khởi tạo
                      </label>
                      <input
                        type="password"
                        className="crm-form-input"
                        placeholder="Mặc định: PolarisX123456!"
                        value={newStaffPassword}
                        onChange={(e) => setNewStaffPassword(e.target.value)}
                      />
                    </div>

                    <div style={{ marginBottom: '18px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        Vai trò phân quyền
                      </label>
                      <select
                        className="crm-form-select"
                        value={newStaffRole}
                        onChange={(e) => setNewStaffRole(e.target.value as any)}
                      >
                        <option value="STAFF">Tư vấn viên (Staff/Agent)</option>
                        <option value="OWNER">Đồng quản lý (Owner)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="crm-btn crm-btn-primary"
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      disabled={isLoading}
                    >
                      <Plus size={16} />
                      <span>Tạo Tài Khoản Nhân Viên</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
