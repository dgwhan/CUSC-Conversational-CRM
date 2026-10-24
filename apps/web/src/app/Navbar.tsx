import React, { useState } from 'react';
import { Server, ChevronRight, SlidersHorizontal, Check, LogOut, User, Menu } from 'lucide-react';
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
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  onApiUrlChange,
  onToggleMobileMenu,
}) => {
  const { t } = useTranslation();
  const { isOwner, staffName, logout } = useUserRole();
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
      <div className="crm-breadcrumb" style={{ display: 'flex', alignItems: 'center' }}>
        {onToggleMobileMenu && (
          <button
            type="button"
            className="navbar-mobile-toggle"
            onClick={onToggleMobileMenu}
            title="Mở thanh điều hướng"
          >
            <Menu size={18} />
          </button>
        )}
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

        {/* Thông tin tài khoản & Nút Đăng xuất */}
        <div
          className="crm-user-profile-pill"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px',
            background: 'var(--color-bg-subtle, #f1f5f9)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '9999px',
            fontSize: '13px',
          }}
        >
          <User size={14} style={{ color: 'var(--color-text-secondary, #64748b)' }} />
          <span
            style={{
              fontWeight: 500,
              color: 'var(--color-text-primary, #0f172a)',
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={staffName}
          >
            {staffName}
          </span>
          <button
            type="button"
            onClick={logout}
            title="Đăng xuất khỏi hệ thống"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#ef4444',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <LogOut size={13} />
            <span>Thoát</span>
          </button>
        </div>

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
