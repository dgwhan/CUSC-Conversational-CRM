import React from 'react';
import { Sidebar } from './Sidebar.js';
import { Navbar } from './Navbar.js';

export interface AppLayoutProps {
  children: React.ReactNode;
  onApiUrlChange?: (newUrl: string) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, onApiUrlChange }) => {
  return (
    <div className="crm-app-container">
      <Sidebar />
      <div className="crm-main-viewport">
        <Navbar onApiUrlChange={onApiUrlChange} />
        <main className="crm-content-area">
          {children}
        </main>
      </div>
    </div>
  );
};
