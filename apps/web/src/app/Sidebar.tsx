import React, { useState } from 'react';
import {
  MessageSquare,
  BarChart3,
  Layers,
  FileSpreadsheet,
  LayoutGrid,
  Sliders,
  X,
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
  const { unreadCount } = useRealtime();
  const { config } = useWorkspaceConfig();
  const { isAgent } = useUserRole();

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
    </aside>
  );
};
