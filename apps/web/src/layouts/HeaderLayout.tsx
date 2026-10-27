import React, { useState } from 'react';
import { Server, ChevronRight, Check, LogOut, User, Menu } from 'lucide-react';
import { apiClient } from '../lib/api-client.js';
import type { ActiveNavTab } from '../app/Sidebar.js';
import { useTranslation } from '../i18n/index.js';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher.js';
import { StaffPresenceSelector } from '../modules/realtime/StaffPresenceSelector.js';
import { useUserRole } from '../modules/auth/index.js';
import { WorkspaceSwitcher } from '../modules/workspace/WorkspaceSwitcher.js';
import '../styles/header-layout.css';

export interface HeaderLayoutProps {
  currentTab: ActiveNavTab;
  onTabChange?: (tab: ActiveNavTab) => void;
  onApiUrlChange?: (newUrl: string) => void;
  onToggleMobileMenu?: () => void;
  title?: string;
  extraActions?: React.ReactNode;
}

/**
 * Layout Header chuyên biệt cho toàn bộ ứng dụng CUSC Conversational CRM.
 * Được tách thành layout riêng biệt độc lập với App.tsx để dễ dàng bảo trì,
 * chỉnh sửa giao diện navigation, breadcrumb, quick tabs, và các widgets tiện ích.
 * Hỗ trợ tối ưu responsive đa kích thước màn hình (Desktop, Tablet, Mobile).
 */
export const HeaderLayout: React.FC<HeaderLayoutProps> = ({
  currentTab,
  onApiUrlChange,
  onToggleMobileMenu,
  title,
  extraActions,
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
    if (title) return title;
    switch (currentTab as string) {
      case 'inbox':
        return t('nav.liveChatBreadcrumb');
      case 'kanban':
        return 'Bảng Phễu Tuyển Sinh (Kanban)';
      case 'reports':
        return 'Báo Cáo & Thống Kê Tuyển Sinh (Analytics)';
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
      {/* 1. KHU VỰC TOP ROW (BREADCRUMB TRÁI & UTILITIES PHẢI TRÊN MOBILE, FLATTEN TRÊN DESKTOP) */}
      <div className="crm-navbar-top-row">
        {/* Breadcrumb bên trái & Nút mở Sidebar Menu trên Mobile */}
        <div className="crm-navbar-left">
          <div className="crm-breadcrumb">
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
            <span className="crumb-current" title={getBreadcrumbTitle()}>
              {getBreadcrumbTitle()}
            </span>
          </div>
        </div>

        {/* Khu vực Utilities bên phải (Role, Presence, Language, Profile, API) */}
        <div className="crm-navbar-right crm-navbar-actions">
          {/* Tab chuyển đổi nhanh giữa các Workspace (Workspace Switcher) */}
          <WorkspaceSwitcher />
          {/* Trạng thái nhân viên trực tuyến & Chuông thông báo Ting ting */}
          <StaffPresenceSelector />

          {/* Chuyển đổi ngôn ngữ Tiếng Việt / English */}
          <LanguageSwitcher />

          {/* Thông tin tài khoản người dùng & Nút Đăng xuất */}
          <div className="crm-user-profile-pill">
            <User size={14} className="crm-user-profile-icon" />
            <span
              className="crm-user-profile-name"
              title={staffName || (isOwner ? 'Chủ doanh nghiệp' : 'Tư vấn viên')}
            >
              {staffName || (isOwner ? 'Chủ doanh nghiệp' : 'Tư vấn viên')}
            </span>
            <button
              type="button"
              className="crm-user-logout-btn"
              onClick={logout}
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut size={13} />
              <span className="logout-text">Thoát</span>
            </button>
          </div>

          {/* Trạng thái kết nối máy chủ API Backend */}
          <div
            className="crm-status-pill"
            onClick={() => setShowConfig(!showConfig)}
            title="Bấm để cấu hình URL kết nối API"
          >
            <span className="crm-status-dot online"></span>
            <Server size={14} />
            <span className="crm-status-text">
              API: <code>{apiUrl}</code>
            </span>
          </div>

          {/* Các action widget bổ sung nếu truyền từ bên ngoài */}
          {extraActions}
        </div>
      </div>




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
    </header>
  );
};
