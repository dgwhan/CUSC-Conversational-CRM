import React, { useState } from 'react';
import { Server, ChevronRight, SlidersHorizontal, Check } from 'lucide-react';
import { apiClient } from '../lib/api-client.js';
import type { ActiveNavTab } from './Sidebar.js';
import { useTranslation } from '../i18n/index.js';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher.js';
import { StaffPresenceSelector } from '../modules/realtime/StaffPresenceSelector.js';
import { RoleSwitcher, useUserRole } from '../modules/auth/index.js';

interface NavbarProps {
  currentTab: ActiveNavTab;
  onTabChange?: (tab: ActiveNavTab) => void;
  onApiUrlChange?: (newUrl: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange, onApiUrlChange }) => {
  const { t } = useTranslation();
  const { isOwner } = useUserRole();
  const [showConfig, setShowConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState(apiClient.getBaseUrl());

  const handleSaveApi = () => {
    apiClient.setBaseUrl(apiUrl);
    if (onApiUrlChange) onApiUrlChange(apiUrl);
    setShowConfig(false);
  };

  const getBreadcrumbTitle = () => {
    switch (currentTab) {
      case 'inbox':
        return t('nav.liveChatBreadcrumb');
      case 'kanban':
        return 'Bảng Phễu Tuyển Sinh (Kanban Admission Pipeline)';
      case 'onboarding':
        return t('nav.onboardingBreadcrumb');
      case 'import':
        return t('nav.importBreadcrumb');
      default:
        return t('nav.socialComm');
    }
  };

  return (
    <header className="crm-navbar">
      <div className="crm-breadcrumb">
        <span className="crumb-root">{t('nav.crmSystem')}</span>
        <ChevronRight size={14} className="crumb-separator" />
        <span className="crumb-module">{t('nav.socialComm')}</span>
        <ChevronRight size={14} className="crumb-separator" />
        <span className="crumb-current">{getBreadcrumbTitle()}</span>
      </div>

      <div className="crm-navbar-actions">
        {/* Quick Tab Switcher Pills */}
        <div className="navbar-quick-tabs">
          <button
            type="button"
            className={`navbar-tab-btn ${currentTab === 'inbox' ? 'active' : ''}`}
            onClick={() => onTabChange?.('inbox')}
          >
            {t('nav.quickTabInbox')}
          </button>
          <button
            type="button"
            className={`navbar-tab-btn ${currentTab === 'kanban' ? 'active' : ''}`}
            onClick={() => onTabChange?.('kanban')}
          >
            Phễu Kanban
          </button>
          {isOwner && (
            <button
              type="button"
              className={`navbar-tab-btn ${currentTab === 'onboarding' ? 'active' : ''}`}
              onClick={() => onTabChange?.('onboarding')}
              title="Chỉ Chủ doanh nghiệp có quyền thiết lập kênh MXH"
            >
              {t('nav.quickTabOnboarding')}
            </button>
          )}
          <button
            type="button"
            className={`navbar-tab-btn ${currentTab === 'import' ? 'active' : ''}`}
            onClick={() => onTabChange?.('import')}
          >
            {t('nav.quickTabImport')}
          </button>
        </div>

        {/* Nút Chuyển đổi Vai trò RBAC (Chủ DN <-> Nhân viên tư vấn) */}
        <RoleSwitcher />

        {/* Trạng thái nhân viên & Chuông Ting ting */}
        <StaffPresenceSelector />

        <LanguageSwitcher />

        <div className="crm-status-pill">
          <span className="crm-status-dot online"></span>
          <Server size={14} />
          <span>API: <code>{apiUrl}</code></span>
        </div>

        {isOwner && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowConfig(!showConfig)}
            title={t('nav.apiConfigTitle')}
          >
            <SlidersHorizontal size={14} />
            <span>{t('nav.apiConfig')}</span>
          </button>
        )}

        {showConfig && (
          <div className="crm-config-popover">
            <div className="popover-title">{t('nav.apiConfigTitle')}</div>
            <div className="popover-body">
              <input
                type="text"
                className="form-input form-input-sm"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="/api hoặc http://localhost:3000/api"
              />
              <div className="popover-presets">
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => setApiUrl('/api')}
                >
                  Proxy (/api)
                </button>
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => setApiUrl('http://localhost:3000/api')}
                >
                  Direct (:3000)
                </button>
              </div>
            </div>
            <div className="popover-footer">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveApi}
              >
                <Check size={14} />
                <span>{t('nav.apiConfigSave')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
