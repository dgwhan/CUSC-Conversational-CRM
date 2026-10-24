import React from 'react';
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
  return (
    <div className="crm-app-container">
      <Sidebar currentTab={currentTab} onTabChange={onTabChange} />
      <div className="crm-main-viewport">
        <Navbar
          currentTab={currentTab}
          onTabChange={onTabChange}
          onApiUrlChange={onApiUrlChange}
        />
        <main className={`crm-content-area ${currentTab === 'inbox' ? 'pancake-fullscreen' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
};
