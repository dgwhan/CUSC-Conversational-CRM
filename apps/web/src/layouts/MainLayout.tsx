import React, { useState } from 'react';
import '../App.css';
import { Sidebar, type ActiveNavTab } from '../app/Sidebar.js';
import { HeaderLayout } from './HeaderLayout.js';

export interface MainLayoutProps {
  children: React.ReactNode;
  currentTab: ActiveNavTab;
  onTabChange: (tab: ActiveNavTab) => void;
  onApiUrlChange?: (newUrl: string) => void;
  headerTitle?: string;
  headerExtraActions?: React.ReactNode;
}

/**
 * Layout chính của CRM (Sidebar + HeaderLayout + Content Viewport).
 * Tách biệt hoàn toàn Header và Sidebar thành các lớp layout chuyên biệt.
 */
export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  currentTab,
  onTabChange,
  onApiUrlChange,
  headerTitle,
  headerExtraActions,
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="crm-app-container">
      {/* Overlay mờ khi mở menu trên mobile */}
      <div
        className={`crm-sidebar-overlay ${isMobileSidebarOpen ? 'active' : ''}`}
        onClick={() => setIsMobileSidebarOpen(false)}
      />

      {/* 1. Thanh Menu Điều Hướng Bên Trái (Sidebar) */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          onTabChange(tab);
          setIsMobileSidebarOpen(false);
        }}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. Khung Viewport Chính: Gồm HeaderLayout và Main Content */}
      <div className="crm-main-viewport">
        <HeaderLayout
          currentTab={currentTab}
          onTabChange={onTabChange}
          onApiUrlChange={onApiUrlChange}
          onToggleMobileMenu={() => setIsMobileSidebarOpen((prev) => !prev)}
          title={headerTitle}
          extraActions={headerExtraActions}
        />

        <main className={`crm-content-area ${currentTab === 'inbox' ? 'pancake-fullscreen' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
};
