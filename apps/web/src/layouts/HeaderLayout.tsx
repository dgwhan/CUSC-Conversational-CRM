import React, { useState } from 'react';
import { Server, ChevronRight, Check, LogOut, User, Menu } from 'lucide-react';
import { apiClient } from '../lib/api-client.js';
import type { ActiveNavTab } from '../app/Sidebar.js';
import { useTranslation } from '../i18n/index.js';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher.js';
import { StaffPresenceSelector } from '../modules/realtime/StaffPresenceSelector.js';
import { useRealtime } from '../modules/realtime/RealtimeContext.js';
import { RoleSwitcher, useUserRole } from '../modules/auth/index.js';

export interface HeaderLayoutProps {
  currentTab: ActiveNavTab;
  onTabChange?: (tab: ActiveNavTab) => void;
  onApiUrlChange?: (newUrl: string) => void;
  onToggleMobileMenu?: () => void;
  title?: string;
  extraActions?: React.ReactNode;
}

/**
 * Layout Header chuyên biệt cho toàn bộ ứng dụng CUSC Recruitment CRM.
 * Được tách thành layout riêng biệt độc lập với App.tsx để dễ dàng bảo trì,
 * chỉnh sửa giao diện navigation, breadcrumb, quick tabs, và các widgets tiện ích.
 */
export const HeaderLayout: React.FC<HeaderLayoutProps> = ({
  currentTab,
  onTabChange,
  onApiUrlChange,
  onToggleMobileMenu,
  title,
  extraActions,
}) => {
  const { t } = useTranslation();
  const { isOwner, staffName, logout } = useUserRole();
  const { unreadCount } = useRealtime();
  const [showConfig, setShowConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState(apiClient.getBaseUrl());

  const handleSaveApi = () => {
    apiClient.setBaseUrl(apiUrl);
    if (onApiUrlChange) onApiUrlChange(apiUrl);
    setShowConfig(false);
  };

  const getBreadcrumbTitle = () => {
    if (title) return title;
    switch (currentTab) {
      case 'inbox':
        return t('nav.liveChatBreadcrumb');
      case 'kanban':
        return 'Bảng Phễu Tuyển Sinh (Kanban Admission Pipeline)';
      case 'workspace-settings':
        return 'Cấu Hình Phễu & Multi-tenant';
      case 'onboarding':
        return t('nav.onboardingBreadcrumb');
      case 'import':
        return t('nav.importBreadcrumb');
      default:
        return t('nav.socialComm');
    }
  };

  return (
    <header className="crm-navbar" role="banner">
      {/* 1. KHU VỰC BREADCRUMB BÊN TRÁI & NÚT MỞ MENU MOBILE */}
      <div className="crm-breadcrumb" style={{ display: 'flex', alignItems: 'center' }}>
        {onToggleMobileMenu && (
          <button
            type="button"
            className="navbar-mobile-toggle"
            onClick={onToggleMobileMenu}
            title="Mở thanh điều hướng"
            aria-label="Toggle navigation menu"
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

      {/* 2. KHU VỰC THAO TÁC, QUICK TABS & WIDGETS BÊN PHẢI */}
      <div className="crm-navbar-actions">
        {/* Phím tắt chuyển nhanh giữa các Module chính */}
        <nav className="navbar-quick-tabs" aria-label="Quick tabs">
          <button
            type="button"
            className={`navbar-tab-btn ${currentTab === 'inbox' ? 'active' : ''}`}
            onClick={() => onTabChange?.('inbox')}
          >
            {t('nav.quickTabInbox')}
            {unreadCount > 0 && (
              <span
                className="navbar-unread-dot"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '16px',
                  height: '16px',
                  marginLeft: '6px',
                  padding: '0 4px',
                  borderRadius: '999px',
                  background: 'var(--gradient-danger, #ef4444)',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
                title={`${unreadCount} tin nhắn chưa đọc`}
              >
                {unreadCount}
              </span>
            )}
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
              className={`navbar-tab-btn ${currentTab === 'workspace-settings' ? 'active' : ''}`}
              onClick={() => onTabChange?.('workspace-settings')}
              title="Cấu hình phễu & Quản lý nhân viên"
            >
              Cấu hình & Staff
            </button>
          )}

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
        </nav>

        {/* Nút Chuyển đổi Vai trò RBAC (Chủ DN <-> Nhân viên tư vấn) */}
        <RoleSwitcher />

        {/* Trạng thái nhân viên trực tuyến & Chuông thông báo Ting ting */}
        <StaffPresenceSelector />

        {/* Chuyển đổi ngôn ngữ Tiếng Việt / English */}
        <LanguageSwitcher />

        {/* Thông tin tài khoản người dùng & Nút Đăng xuất */}
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
            {staffName || (isOwner ? 'Chủ doanh nghiệp' : 'Tư vấn viên')}
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

        {/* Trạng thái kết nối máy chủ API Backend */}
        <div className="crm-status-pill">
          <span className="crm-status-dot online"></span>
          <Server size={14} />
          <span>API: <code>{apiUrl}</code></span>
        </div>

        {/* Các action widget bổ sung nếu truyền từ bên ngoài */}
        {extraActions}

        {/* Popover cấu hình URL API Backend (nếu bật) */}
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
