import React from 'react';
import { LogOut, User, Menu } from 'lucide-react';
import type { ActiveNavTab } from '../app/Sidebar.js';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher.js';
import { StaffPresenceSelector } from '../modules/realtime/StaffPresenceSelector.js';
import { NotificationCenter } from '../modules/notification/NotificationCenter.js';
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
  currentTab: _currentTab,
  onTabChange,
  onToggleMobileMenu,
  title: _title,
  extraActions,
}) => {
  const { isOwner, staffName, logout } = useUserRole();

    return (
    <header className="crm-navbar" role="banner">
      {/* 1. KHU VỰC TOP ROW (BREADCRUMB TRÁI & UTILITIES PHẢI TRÊN MOBILE, FLATTEN TRÊN DESKTOP) */}
      <div className="crm-navbar-top-row">
        {/* Breadcrumb bên trái & Nút mở Sidebar Menu trên Mobile */}
        <div className="crm-navbar-left">
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
        </div>

        {/* Khu vực Utilities bên phải (Role, Presence, Language, Profile, API) */}
        <div className="crm-navbar-right crm-navbar-actions">
          {/* Tab chuyển đổi nhanh giữa các Workspace (Workspace Switcher) */}
          <WorkspaceSwitcher />
          {/* Hộp lưu thông báo trung tâm (Workspace Notification Center) */}
          <NotificationCenter onNavigateTab={onTabChange} />
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

          {/* Các action widget bổ sung nếu truyền từ bên ngoài */}
          {extraActions}
        </div>
      </div>
    </header>
  );
};
