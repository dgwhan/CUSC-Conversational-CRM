import React, { useState } from 'react';
import {
  MessageSquare,
  BarChart3,
  Layers,
  FileSpreadsheet,
  LayoutGrid,
  Sliders,
  X,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useTranslation } from '../i18n/index.js';
import { useRealtime } from '../modules/realtime/RealtimeContext.js';
import { useUserRole } from '../modules/auth/UserRoleContext.js';
import { useWorkspaceConfig } from '../modules/workspace/WorkspaceConfigContext.js';
import { notify } from '../components/feedback/toastEmitter.js';

export type ActiveNavTab = 'inbox' | 'kanban' | 'reports' | 'onboarding' | 'import' | 'workspace-settings';

export interface SidebarProps {
  currentTab: ActiveNavTab;
  onTabChange: (tab: ActiveNavTab) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { t } = useTranslation();
  const { myPresence, unreadCount } = useRealtime();
  const { config } = useWorkspaceConfig();
  const { isOwner, isAgent, staffName, logout } = useUserRole();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('crm_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('crm_sidebar_collapsed', String(next));
      } catch { }
      return next;
    });
  };

  const mainNavItems = [
    {
      id: 'reports' as ActiveNavTab,
      label: t('nav.reportsStats'),
      icon: <BarChart3 size={18} />,
    },
    {
      id: 'inbox' as ActiveNavTab,
      label: t('nav.liveInbox'),
      icon: <MessageSquare size={18} />,
      badgeCount: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      id: 'kanban' as ActiveNavTab,
      label: (config.terminology.pipelineName || 'Phễu Tuyển Sinh & Đào Tạo')
        .replace(/\s*(CUSC|PolarisX)/gi, '')
        .trim() || 'Phễu Tuyển Sinh & Đào Tạo',
      icon: <LayoutGrid size={18} />,
    },
    {
      id: 'workspace-settings' as ActiveNavTab,
      label: 'Quản lý cấu hình',
      icon: <Sliders size={18} />,
      restricted: isAgent,
    },
    {
      id: 'onboarding' as ActiveNavTab,
      label: t('nav.onboarding'),
      icon: <Layers size={18} />,
      restricted: isAgent,
    },
    {
      id: 'import' as ActiveNavTab,
      label: t('nav.dataImport'),
      icon: <FileSpreadsheet size={18} />,
    },
  ];

  return (
    <aside className={`crm-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      {/* Brand Header */}
      <div className={`crm-sidebar-brand ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="crm-brand-text">
          <span className="crm-brand-title">Conversational CRM</span>
        </div>
        <button
          type="button"
          className="crm-sidebar-toggle-btn"
          onClick={toggleCollapse}
          title={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          aria-label={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        {onCloseMobile && (
          <button
            type="button"
            className="navbar-mobile-toggle"
            onClick={onCloseMobile}
            style={{ marginLeft: 'auto', display: isMobileOpen ? 'inline-flex' : undefined }}
            title="Đóng menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Main Navigation Menu */}
      <div className="crm-sidebar-menu">
        <nav className="crm-nav-list">
          {mainNavItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`crm-nav-item ${isActive ? 'active' : ''} ${item.restricted ? 'nav-restricted' : ''}`}
                title={isCollapsed ? item.label : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  if (item.restricted) {
                    notify.warning(
                      'Bạn đang ở vai trò Tư vấn viên (Agent). Tính năng này chỉ dành cho Chủ doanh nghiệp (Owner).',
                      'Hạn chế Quyền hạn'
                    );
                    return;
                  }
                  onTabChange(item.id);
                }}
                style={item.restricted ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
              >
                <span className="crm-nav-icon">
                  {item.icon}
                  {item.id === 'inbox' && Boolean(unreadCount > 0) && (
                    <span
                      className="sidebar-unread-dot"
                      title={`${unreadCount} tin nhắn mới chưa đọc`}
                    />
                  )}
                </span>
                <span className="crm-nav-label">{item.label}</span>
                {Boolean(item.badgeCount) && (
                  <span className="unread-total-badge">
                    {item.badgeCount! > 99 ? '99+' : item.badgeCount}
                  </span>
                )}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile */}
      <div className={`crm-sidebar-footer ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="crm-user-profile" title={isCollapsed ? (staffName || 'Người dùng') : undefined}>
          <div className="crm-user-avatar-wrapper">
            <div className="crm-user-avatar">
              {staffName ? staffName.slice(0, 2).toUpperCase() : 'US'}
            </div>
            <span
              className={`staff-status-dot ${myPresence.toLowerCase()}`}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 10,
                height: 10,
                borderRadius: '50%',
                border: '2px solid white',
              }}
            />
          </div>

          <div className="crm-user-info">
            <span
              className="crm-user-name"
              title={staffName || ''}
            >
              {staffName}
            </span>
            <span
              className="crm-user-role"
              style={{
                color: isOwner ? '#0284c7' : '#ea580c',
              }}
            >
              {isOwner ? 'Chủ doanh nghiệp' : 'Tư vấn viên'}
            </span>
          </div>

          <button
            type="button"
            className="crm-user-logout-btn"
            onClick={logout}
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};
