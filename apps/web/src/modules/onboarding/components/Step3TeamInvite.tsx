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
  const { t } = useTranslation();
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<'ADMIN' | 'AGENT'>('AGENT');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activePages = pages.filter((p) => p.selected);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg(t('onboarding.step3.errors.invalidEmail'));
      return;
    }
    if (invites.some((inv) => inv.email === cleanEmail)) {
      setErrorMsg(t('onboarding.step3.errors.duplicateEmail'));
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
          <h2 className="onboarding-card-title">{t('onboarding.step3.title')}</h2>
          <p className="onboarding-card-desc">
            {t('onboarding.step3.desc')}
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
              placeholder={t('onboarding.step3.emailPlaceholder')}
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
              <option value="AGENT">{t('onboarding.step3.agentRole')}</option>
              <option value="ADMIN">{t('onboarding.step3.adminRole')}</option>
            </select>
          </div>

          <button
            type="submit"
            className="crm-btn crm-btn-secondary"
            style={{ whiteSpace: 'nowrap' }}
          >
            <UserPlus size={16} />
            {t('onboarding.step3.addBtn')}
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
                      {inv.role === 'ADMIN' ? t('onboarding.step3.adminRole') : t('onboarding.step3.agentRole')}
                    </span>
                  </td>
                  <td className="permission-desc">
                    {inv.role === 'ADMIN'
                      ? t('onboarding.step3.adminDesc')
                      : t('onboarding.step3.agentDesc')}
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
