import React, { useState, useEffect } from 'react';
import type { KanbanCandidate } from './kanban.types.js';
import type { ChannelType, LeadStage } from '../inbox/types.js';
import { X, UserPlus } from 'lucide-react';
import { notify } from '../../components/feedback/toastEmitter.js';
import { useWorkspaceConfig } from '../workspace/WorkspaceConfigContext.js';

interface NewCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCandidate: (candidate: KanbanCandidate) => void;
}

export const NewCandidateModal: React.FC<NewCandidateModalProps> = ({
  isOpen,
  onClose,
  onAddCandidate,
}) => {
  const { config } = useWorkspaceConfig();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [channel, setChannel] = useState<ChannelType>('FACEBOOK');
  const [stage, setStage] = useState<LeadStage>(config.pipelineStages[0]?.id || 'NEW');
  const [course, setCourse] = useState(config.productCatalog[0]?.name || '');
  const [estimatedTuition, setEstimatedTuition] = useState(
    String(config.productCatalog[0]?.defaultPrice || 20000000)
  );
  const [assignedStaff, setAssignedStaff] = useState('staff-1');
  const [notes, setNotes] = useState('');

  // Cập nhật giá mặc định khi đổi sản phẩm / khóa học
  const handleProductChange = (selectedName: string) => {
    setCourse(selectedName);
    const found = config.productCatalog.find((p) => p.name === selectedName);
    if (found && found.defaultPrice) {
      setEstimatedTuition(String(found.defaultPrice));
    }
  };

  useEffect(() => {
    if (config.pipelineStages.length > 0 && !config.pipelineStages.some((s) => s.id === stage)) {
      setStage(config.pipelineStages[0].id);
    }
    if (config.productCatalog.length > 0 && !config.productCatalog.some((p) => p.name === course)) {
      setCourse(config.productCatalog[0].name);
      setEstimatedTuition(String(config.productCatalog[0].defaultPrice || 20000000));
    }
  }, [config, stage, course]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      notify.warning(`Vui lòng nhập họ và tên ${config.terminology.entityName.toLowerCase()}.`);
      return;
    }

    const staffMap: Record<string, { name: string; avatar: string }> = {
      'staff-1': { name: 'Nguyễn Văn Minh (Bạn)', avatar: 'MV' },
      'staff-2': { name: 'Lê Thị Thu Lan', avatar: 'TL' },
      'staff-3': { name: 'Trần Hoàng Nam', avatar: 'HN' },
    };

    const newCandidate: KanbanCandidate = {
      id: `cand-${Date.now()}`,
      fullName: fullName.trim(),
      phone: phone.trim() || 'Chưa có SĐT',
      email: email.trim() || 'Chưa có Email',
      avatarUrl: `https://images.unsplash.com/photo-${1535713875002 + Math.floor(Math.random() * 1000)}?w=120&auto=format&fit=crop&q=80`,
      channel,
      channelAccountName:
        channel === 'FACEBOOK'
          ? 'Fanpage Tiếp Nhận'
          : channel === 'ZALO'
          ? 'Zalo OA Doanh Nghiệp'
          : channel === 'ZALO_PERSONAL'
          ? 'Zalo Cá Nhân Tư Vấn'
          : 'Tiếp nhận trực tiếp',
      stage,
      estimatedTuition: Number(estimatedTuition) || 20000000,
      priority: 'HIGH',
      interestCourses: [course || 'Gói dịch vụ mặc định'],
      assignedStaffId: assignedStaff,
      assignedStaffName: staffMap[assignedStaff]?.name || 'Nguyễn Văn Minh',
      assignedStaffAvatar: staffMap[assignedStaff]?.avatar || 'MV',
      assignedStaffPresence: 'ONLINE',
      lastActivityAt: 'Vừa xong',
      notesCount: notes.trim() ? 1 : 0,
      tags: ['Thêm thủ công', 'Ưu tiên chăm sóc'],
    };

    onAddCandidate(newCandidate);
    notify.success(`Đã thêm "${newCandidate.fullName}" vào ${config.terminology.pipelineName.toLowerCase()}!`);
    onClose();
  };

  return (
    <div className="crm-modal-backdrop" onClick={onClose}>
      <div className="crm-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="crm-modal-header">
          <div className="modal-title-row">
            <UserPlus size={18} className="modal-title-icon" />
            <h3 className="modal-title">
              Thêm {config.terminology.entityName} vào {config.terminology.pipelineName}
            </h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="crm-modal-body">
          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label">Họ và tên {config.terminology.entityName} *</label>
              <input
                type="text"
                className="crm-form-input"
                placeholder={`VD: Nguyễn Văn A (${config.terminology.entityName})`}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Kênh tiếp nhận</label>
              <select
                className="crm-form-select"
                value={channel}
                onChange={(e) => setChannel(e.target.value as ChannelType)}
              >
                <option value="FACEBOOK">Facebook Messenger / Fanpage</option>
                <option value="ZALO">Zalo Official Account (OA)</option>
                <option value="ZALO_PERSONAL">Zalo Cá nhân của tư vấn viên</option>
                <option value="TIKTOK">TikTok Channel</option>
                <option value="MANUAL">Trực tiếp / Hotline</option>
              </select>
            </div>
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label">Số điện thoại liên hệ</label>
              <input
                type="tel"
                className="crm-form-input"
                placeholder="VD: 0912.345.678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email liên hệ</label>
              <input
                type="email"
                className="crm-form-input"
                placeholder="VD: customer@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label">Giai đoạn ban đầu</label>
              <select
                className="crm-form-select"
                value={stage}
                onChange={(e) => setStage(e.target.value as LeadStage)}
              >
                {config.pipelineStages.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nhân viên phụ trách</label>
              <select
                className="crm-form-select"
                value={assignedStaff}
                onChange={(e) => setAssignedStaff(e.target.value)}
              >
                <option value="staff-1">Nguyễn Văn Minh (Bạn) - Online</option>
                <option value="staff-2">Lê Thị Thu Lan - Away</option>
                <option value="staff-3">Trần Hoàng Nam - Busy</option>
              </select>
            </div>
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label">{config.terminology.productLabel} quan tâm</label>
              <select
                className="crm-form-select"
                value={course}
                onChange={(e) => handleProductChange(e.target.value)}
              >
                {config.productCatalog.map((prod) => (
                  <option key={prod.id} value={prod.name}>
                    {prod.name} ({new Intl.NumberFormat('vi-VN').format(prod.defaultPrice)} đ)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{config.terminology.valueLabel}</label>
              <input
                type="number"
                step="500000"
                className="crm-form-input"
                value={estimatedTuition}
                onChange={(e) => setEstimatedTuition(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Ghi chú ban đầu (Nhu cầu trao đổi)</label>
            <textarea
              className="crm-form-textarea"
              rows={2}
              placeholder="VD: Cần tư vấn chi tiết chính sách, đã trao đổi qua tin nhắn..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="crm-modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Hủy bỏ
            </button>
            <button type="submit" className="btn btn-primary">
              <UserPlus size={15} />
              <span>Thêm vào phễu</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
