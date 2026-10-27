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
import { useTranslation } from '../../../i18n/index.js';

export interface Step3TeamInviteProps {
  business: BusinessSetupData;
  pages: FanpageItem[];
  invites: StaffInvite[];
  onAddInvite: (email: string, role: 'ADMIN' | 'AGENT') => Promise<void> | void;
  onRemoveInvite: (id: string) => Promise<void> | void;
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
  const { t } = useTranslation();
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<'ADMIN' | 'AGENT'>('AGENT');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activePages = pages.filter((p) => p.selected);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg(t('onboarding.step3.errors.invalidEmail'));
      return;
    }
    if (invites.some((inv) => inv.email.toLowerCase() === cleanEmail)) {
      setErrorMsg(t('onboarding.step3.errors.duplicateEmail'));
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onAddInvite(cleanEmail, roleInput);
      setEmailInput('');
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể mời thành viên này.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="onboarding-step-form">
      <div className="onboarding-card-header">
        <div className="header-icon-wrapper" style={{ background: 'var(--gradient-success)' }}>
          <UserPlus size={24} />
        </div>
        <div>
          <h2 className="onboarding-card-title">{t('onboarding.step3.title')}</h2>
          <p className="onboarding-card-desc">
            {t('onboarding.step3.desc')}
          </p>
        </div>
      </div>

      {/* Thông báo điều kiện mời thành viên & Chuyển đổi nhanh Workspace */}
      <div
        className="onboarding-invite-rule-alert"
        style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '13px',
          color: '#93c5fd',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          lineHeight: '1.45',
        }}
      >
        <Sparkles size={18} style={{ color: '#60a5fa', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Quy tắc mời thành viên:</strong> Chỉ mời thành công khi tài khoản của thành viên <strong>đã có sẵn trong hệ thống</strong>. Nếu người được mời đang là Owner của Workspace khác, hệ thống sẽ cấp quyền thành viên và hiển thị <strong>tab chuyển đổi nhanh giữa các Workspace</strong> để làm việc đa nhiệm dễ dàng.
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
              placeholder={t('onboarding.step3.emailPlaceholder')}
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="invite-role-field">
            <Shield size={18} className="field-icon" />
            <select
              className="onboarding-select"
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value as 'ADMIN' | 'AGENT')}
              disabled={isSubmitting}
            >
              <option value="AGENT">{t('onboarding.step3.agentRole')}</option>
              <option value="ADMIN">{t('onboarding.step3.adminRole')}</option>
            </select>
          </div>

          <button
            type="submit"
            className="crm-btn crm-btn-secondary"
            style={{ whiteSpace: 'nowrap' }}
            disabled={isSubmitting}
          >
            <UserPlus size={16} />
            {isSubmitting ? 'Đang thêm...' : t('onboarding.step3.addBtn')}
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
        <h4 className="invites-list-title">
          {t('onboarding.step3.invitedListTitle')} ({invites.length})
        </h4>
        <div className="invites-table-wrapper">
          <table className="crm-table">
            <thead>
              <tr>
                <th>{t('onboarding.step3.colEmail')}</th>
                <th>{t('onboarding.step3.colRole')}</th>
                <th>{t('onboarding.step3.colPermissions')}</th>
                <th style={{ width: '80px', textAlign: 'center' }}>{t('onboarding.step3.colAction')}</th>
              </tr>
            </thead>
            <tbody>
              {invites.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <UserPlus size={26} color="#94a3b8" />
                      <span style={{ fontSize: '13px' }}>
                        Chưa có nhân viên nào trong Workspace này. Hãy nhập email ở biểu mẫu phía trên để mời nhân viên tham gia.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                invites.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <div className="user-email-cell">
                        <div className="email-avatar">{inv.email.charAt(0).toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>
                            {inv.fullName || inv.email.split('@')[0]}
                          </div>
                          <span className="email-text" style={{ fontSize: '12px', color: '#64748b' }}>
                            {inv.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`role-badge ${inv.role.toLowerCase()}`}>
                        {inv.role === 'ADMIN' ? 'Quản trị viên (Admin)' : 'Tư vấn viên (Agent)'}
                      </span>
                    </td>
                    <td className="permission-desc">
                      <div>
                        {inv.role === 'ADMIN'
                          ? t('onboarding.step3.adminDesc')
                          : t('onboarding.step3.agentDesc')}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="table-action-btn delete-btn"
                        onClick={() => {
                          if (window.confirm(`Bạn có chắc muốn loại "${inv.fullName || inv.email}" khỏi Workspace?`)) {
                            onRemoveInvite(inv.id);
                          }
                        }}
                        title="Loại nhân viên khỏi Workspace"
                        style={{ cursor: 'pointer' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
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
            <span className="summary-label">{t('onboarding.step3.summaryWorkspace')}:</span>
            <span className="summary-value">{business.companyName || 'Doanh nghiệp PolarisX'}</span>
          </div>
        </div>

        <div className="summary-col">
          <div className="summary-icon">
            <Radio size={20} />
          </div>
          <div>
            <span className="summary-label">{t('onboarding.step3.summaryChannels')}:</span>
            <span className="summary-value">{activePages.length} Fanpage / OA</span>
          </div>
        </div>

        <div className="summary-col">
          <div className="summary-icon">
            <CheckCircle size={20} />
          </div>
          <div>
            <span className="summary-label">{t('onboarding.step3.summaryTeam')}:</span>
            <span className="summary-value">{invites.length} {t('onboarding.step3.agentRole')}</span>
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
          <span>{t('onboarding.step3.backBtn')}</span>
        </button>

        <button
          type="button"
          className="crm-btn crm-btn-success crm-btn-gradient-success"
          style={{ minWidth: '280px' }}
          onClick={onFinish}
        >
          <Sparkles size={18} />
          <span>{t('onboarding.step3.finishBtn')}</span>
        </button>
      </div>
    </div>
  );
};
