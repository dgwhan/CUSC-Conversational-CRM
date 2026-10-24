import React, { useState } from 'react';
import {
  UserPlus,
  Mail,
  Shield,
  Trash2,
  CheckCircle,
  ArrowLeft,
  Sparkles,
  Building,
  Radio,
} from 'lucide-react';
import type { StaffInvite, BusinessSetupData, FanpageItem } from '../types.js';

export interface Step3TeamInviteProps {
  business: BusinessSetupData;
  pages: FanpageItem[];
  invites: StaffInvite[];
  onAddInvite: (email: string, role: 'ADMIN' | 'AGENT') => void;
  onRemoveInvite: (id: string) => void;
  onFinish: () => void;
  onBack: () => void;
}

export const Step3TeamInvite: React.FC<Step3TeamInviteProps> = ({
  business,
  pages,
  invites,
  onAddInvite,
  onRemoveInvite,
  onFinish,
  onBack,
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<'ADMIN' | 'AGENT'>('AGENT');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activePages = pages.filter((p) => p.selected);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Vui lòng nhập định dạng email hợp lệ (VD: nhanvien@cusc.vn).');
      return;
    }
    if (invites.some((inv) => inv.email === cleanEmail)) {
      setErrorMsg('Email này đã có trong danh sách mời.');
      return;
    }
    setErrorMsg(null);
    onAddInvite(cleanEmail, roleInput);
    setEmailInput('');
  };

  return (
    <div className="onboarding-step-form">
      <div className="onboarding-card-header">
        <div className="header-icon-wrapper" style={{ background: 'var(--gradient-success)' }}>
          <UserPlus size={24} />
        </div>
        <div>
          <h2 className="onboarding-card-title">Bước 3: Mời Thành viên Đội ngũ Tư vấn</h2>
          <p className="onboarding-card-desc">
            Phân quyền cho các tư vấn viên hoặc quản lý để cùng trực tin nhắn và chăm sóc ứng viên.
          </p>
        </div>
      </div>

      {/* Form nhập email mời */}
      <form className="invite-form-box" onSubmit={handleAdd}>
        <div className="invite-inputs-row">
          <div className="invite-email-field">
            <Mail size={18} className="field-icon" />
            <input
              type="email"
              className="onboarding-input"
              placeholder="Nhập địa chỉ email nhân sự (VD: agent1@cusc.vn)..."
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
          </div>

          <div className="invite-role-field">
            <Shield size={18} className="field-icon" />
            <select
              className="onboarding-select"
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value as 'ADMIN' | 'AGENT')}
            >
              <option value="AGENT">Tư vấn viên (Agent)</option>
              <option value="ADMIN">Quản lý (Admin)</option>
            </select>
          </div>

          <button
            type="submit"
            className="crm-btn crm-btn-secondary"
            style={{ whiteSpace: 'nowrap' }}
          >
            <UserPlus size={16} />
            Thêm vào danh sách
          </button>
        </div>

        {errorMsg && (
          <div className="onboarding-error-alert compact">
            {errorMsg}
          </div>
        )}
      </form>

      {/* Danh sách thành viên mời */}
      <div className="invites-list-card">
        <h4 className="invites-list-title">Danh sách nhân sự sẽ gửi lời mời ({invites.length})</h4>
        <div className="invites-table-wrapper">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Quyền hạn</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <div className="user-email-cell">
                      <div className="email-avatar">{inv.email.charAt(0).toUpperCase()}</div>
                      <span className="email-text">{inv.email}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`role-badge ${inv.role.toLowerCase()}`}>
                      {inv.role === 'ADMIN' ? 'Quản lý (Admin)' : 'Tư vấn viên (Agent)'}
                    </span>
                  </td>
                  <td className="permission-desc">
                    {inv.role === 'ADMIN'
                      ? 'Xem toàn bộ hội thoại, báo cáo & quản trị kênh'
                      : 'Trực tiếp chat và phân loại lead được giao'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="table-action-btn delete-btn"
                      onClick={() => onRemoveInvite(inv.id)}
                      title="Xóa khỏi danh sách"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tóm tắt tổng quan trước khi hoàn tất */}
      <div className="onboarding-summary-banner">
        <div className="summary-col">
          <div className="summary-icon">
            <Building size={20} />
          </div>
          <div>
            <span className="summary-label">Không gian làm việc:</span>
            <span className="summary-value">{business.companyName || 'Doanh nghiệp CUSC'}</span>
          </div>
        </div>

        <div className="summary-col">
          <div className="summary-icon">
            <Radio size={20} />
          </div>
          <div>
            <span className="summary-label">Kênh kết nối:</span>
            <span className="summary-value">{activePages.length} Fanpage / OA đã kích hoạt</span>
          </div>
        </div>

        <div className="summary-col">
          <div className="summary-icon">
            <CheckCircle size={20} />
          </div>
          <div>
            <span className="summary-label">Đội ngũ:</span>
            <span className="summary-value">{invites.length} Nhân sự tư vấn</span>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="onboarding-card-footer split-footer">
        <button
          type="button"
          className="crm-btn crm-btn-secondary"
          onClick={onBack}
        >
          <ArrowLeft size={18} />
          <span>Quay lại</span>
        </button>

        <button
          type="button"
          className="crm-btn crm-btn-success crm-btn-gradient-success"
          style={{ minWidth: '280px' }}
          onClick={onFinish}
        >
          <Sparkles size={18} />
          <span>Hoàn tất & Vào Không gian làm việc</span>
        </button>
      </div>
    </div>
  );
};
