import React, { useState } from 'react';
import { Sidebar, type ActiveNavTab } from './Sidebar.js';
import { Navbar } from './Navbar.js';

export interface AppLayoutProps {
  children: React.ReactNode;
  currentTab: ActiveNavTab;
  onTabChange: (tab: ActiveNavTab) => void;
  onApiUrlChange?: (newUrl: string) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  currentTab,
  onTabChange,
  onApiUrlChange,
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="crm-app-container">
      {/* Overlay mờ khi mở menu trên mobile */}
      <div
        className={`crm-sidebar-overlay ${isMobileSidebarOpen ? 'active' : ''}`}
        onClick={() => setIsMobileSidebarOpen(false)}
      />

      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          onTabChange(tab);
          setIsMobileSidebarOpen(false);
        }}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="crm-main-viewport">
        <Navbar
          currentTab={currentTab}
          onTabChange={onTabChange}
          onApiUrlChange={onApiUrlChange}
          onToggleMobileMenu={() => setIsMobileSidebarOpen((prev) => !prev)}
        />
        <main className={`crm-content-area ${currentTab === 'inbox' ? 'pancake-fullscreen' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
};
