import React from 'react';
import {
  MessageSquare,
  Users,
  UserCheck,
  BarChart3,
  Settings,
  Layers,
  GraduationCap,
  FileSpreadsheet,
} from 'lucide-react';
import { useTranslation } from '../i18n/index.js';

export type ActiveNavTab = 'inbox' | 'onboarding' | 'import';

export interface SidebarProps {
  currentTab: ActiveNavTab;
  onTabChange: (tab: ActiveNavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const { t } = useTranslation();

  const mainNavItems = [
    {
      id: 'inbox' as ActiveNavTab,
      label: t('nav.liveInbox'),
      icon: <MessageSquare size={18} />,
      tag: 'Live Chat',
      badgeCount: 3,
    },
    {
      id: 'onboarding' as ActiveNavTab,
      label: t('nav.onboarding'),
      icon: <Layers size={18} />,
      tag: 'Wizard 3 bước',
    },
    {
      id: 'import' as ActiveNavTab,
      label: t('nav.dataImport'),
      icon: <FileSpreadsheet size={18} />,
      tag: 'MSG-06',
    },
  ];

  const systemNavItems = [
    { label: t('nav.admissionsMgmt'), icon: <UserCheck size={18} /> },
    { label: t('nav.applicantProfiles'), icon: <Users size={18} /> },
    { label: t('nav.reportsStats'), icon: <BarChart3 size={18} /> },
    { label: t('nav.systemSettings'), icon: <Settings size={18} /> },
  ];

  return (
    <aside className="crm-sidebar">
      <div className="crm-sidebar-brand">
        <div className="crm-brand-icon">
          <GraduationCap size={22} />
        </div>
        <div className="crm-brand-text">
          <span className="crm-brand-name">{t('common.systemName')}</span>
          <span className="crm-brand-sub">{t('common.portalName')}</span>
        </div>
      </div>

      <div className="crm-sidebar-menu">
        <div className="crm-menu-section-label">{t('nav.socialComm')}</div>
        <nav className="crm-nav-list">
          {mainNavItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`crm-nav-item ${isActive ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  onTabChange(item.id);
                }}
              >
                <span className="crm-nav-icon">{item.icon}</span>
                <span className="crm-nav-label">{item.label}</span>
                {item.badgeCount ? (
                  <span className="unread-total-badge" style={{ marginLeft: 'auto', fontSize: '10px' }}>
                    {item.badgeCount}
                  </span>
                ) : (
                  item.tag && <span className="crm-nav-tag">{item.tag}</span>
                )}
              </a>
            );
          })}
        </nav>

        <div className="crm-menu-section-label" style={{ marginTop: '20px' }}>
          {t('nav.trainingMgmt')}
        </div>
        <nav className="crm-nav-list">
          {systemNavItems.map((item, idx) => (
            <a
              key={idx}
              href="#"
              className="crm-nav-item"
              style={{ opacity: 0.65 }}
              onClick={(e) => e.preventDefault()}
            >
              <span className="crm-nav-icon">{item.icon}</span>
              <span className="crm-nav-label">{item.label}</span>
            </a>
          ))}
        </nav>
      </div>

      <div className="crm-sidebar-footer">
        <div className="crm-user-profile">
          <div className="crm-user-avatar">MV</div>
          <div className="crm-user-info">
            <span className="crm-user-name">Nguyễn Văn Minh</span>
            <span className="crm-user-role">{t('nav.userRole')}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
