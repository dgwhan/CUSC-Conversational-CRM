import React, { useState } from 'react';
import type { KanbanCandidate } from './kanban.types.js';
import { KANBAN_COLUMNS } from './kanban.config.js';
import type { ChannelType, LeadStage } from '../inbox/types.js';
import { X, UserPlus } from 'lucide-react';
import { notify } from '../../components/feedback/toastEmitter.js';
import { useUserRole } from '../auth/UserRoleContext.js';

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
  const { staffName } = useUserRole();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [channel, setChannel] = useState<ChannelType>('FACEBOOK');
  const [stage, setStage] = useState<LeadStage>('NEW');
  const [course, setCourse] = useState('Lập trình Fullstack Web (React & NestJS)');
  const [estimatedTuition, setEstimatedTuition] = useState('26500000');
  const [assignedStaff, setAssignedStaff] = useState('staff-1');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      notify.warning('Vui lòng nhập họ và tên thí sinh/khách hàng.');
      return;
    }

    const staffMap: Record<string, { name: string; avatar: string }> = {
      'staff-1': {
        name: staffName ? `${staffName} (Bạn)` : 'Bạn',
        avatar: staffName ? staffName.slice(0, 2).toUpperCase() : 'ME',
      },
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
          ? 'Fanpage Tuyển Sinh CUSC'
          : channel === 'ZALO'
          ? 'Zalo OA CUSC Can Tho'
          : 'Tuyển sinh trực tiếp',
      stage,
      estimatedTuition: Number(estimatedTuition) || 20000000,
      priority: 'HIGH',
      interestCourses: [course],
      assignedStaffId: assignedStaff,
      assignedStaffName: staffMap[assignedStaff]?.name || staffName || 'Bạn',
      assignedStaffAvatar: staffMap[assignedStaff]?.avatar || 'MV',
      assignedStaffPresence: 'ONLINE',
      lastActivityAt: 'Vừa xong',
      notesCount: notes.trim() ? 1 : 0,
      tags: ['Thêm thủ công', 'Ưu tiên xét tuyển'],
    };

    onAddCandidate(newCandidate);
    notify.success(`Đã thêm thí sinh "${newCandidate.fullName}" vào phễu tuyển sinh!`);
    onClose();
  };

  return (
    <div className="crm-modal-backdrop" onClick={onClose}>
      <div className="crm-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="crm-modal-header">
          <div className="modal-title-row">
            <UserPlus size={18} className="modal-title-icon" />
            <h3 className="modal-title">Thêm Thí sinh / Khách hàng vào Phễu Tuyển sinh</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="crm-modal-body">
          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label">Họ và tên thí sinh *</label>
              <input
                type="text"
                className="crm-form-input"
                placeholder="VD: Lê Hoàng Nam"
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
              <label className="form-label">Số điện thoại</label>
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
                placeholder="VD: hoangnam@gmail.com"
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
                {KANBAN_COLUMNS.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.title}
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
                <option value="staff-1">{staffName ? `${staffName} (Bạn) - Online` : 'Bạn - Online'}</option>
                <option value="staff-2">Lê Thị Thu Lan - Away</option>
                <option value="staff-3">Trần Hoàng Nam - Busy</option>
              </select>
            </div>
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label">Chương trình / Khóa học quan tâm</label>
              <select
                className="crm-form-select"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              >
                <option value="Lập trình Fullstack Web (React & NestJS)">
                  Lập trình Fullstack Web (React & NestJS)
                </option>
                <option value="Lập trình viên Quốc tế Aptech ADSE">
                  Lập trình viên Quốc tế Aptech ADSE
                </option>
                <option value="Thiết kế Đồ họa Đa phương tiện Arena">
                  Thiết kế Đồ họa Đa phương tiện Arena
                </option>
                <option value="Lập trình Python & Trí tuệ Nhân tạo AI">
                  Lập trình Python & Trí tuệ Nhân tạo AI
                </option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Học phí dự kiến (VNĐ)</label>
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
            <label className="form-label">Ghi chú ban đầu (Nhu cầu tuyển sinh)</label>
            <textarea
              className="crm-form-textarea"
              rows={2}
              placeholder="VD: Đã tốt nghiệp THPT năm 2026, hỏi học bổng 20% và lịch học buổi tối..."
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
