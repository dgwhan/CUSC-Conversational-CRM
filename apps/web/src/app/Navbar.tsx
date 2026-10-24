import React, { useState } from 'react';
import { Server, ChevronRight, SlidersHorizontal, Check } from 'lucide-react';
import { apiClient } from '../lib/api-client.js';
import type { ActiveNavTab } from './Sidebar.js';

interface NavbarProps {
  currentTab: ActiveNavTab;
  onTabChange?: (tab: ActiveNavTab) => void;
  onApiUrlChange?: (newUrl: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange, onApiUrlChange }) => {
  const [showConfig, setShowConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState(apiClient.getBaseUrl());

  const handleSaveApi = () => {
    apiClient.setBaseUrl(apiUrl);
    if (onApiUrlChange) onApiUrlChange(apiUrl);
    setShowConfig(false);
  };

  const getBreadcrumbTitle = () => {
    switch (currentTab) {
      case 'inbox':
        return 'Hộp thư Trực tuyến Đa kênh (Pancake Live Chat)';
      case 'onboarding':
        return 'Quy trình Thiết lập Kênh & Onboarding Wizard';
      case 'import':
        return 'Nhập tay & Bảng tính In-App Grid (MSG-06)';
      default:
        return 'Giao tiếp Đa kênh';
    }
  };

  return (
    <header className="crm-navbar">
      <div className="crm-breadcrumb">
        <span className="crumb-root">Hệ thống CRM</span>
        <ChevronRight size={14} className="crumb-separator" />
        <span className="crumb-module">Giao tiếp Đa kênh</span>
        <ChevronRight size={14} className="crumb-separator" />
        <span className="crumb-current">{getBreadcrumbTitle()}</span>
      </div>

      <div className="crm-navbar-actions">
        {/* Quick Tab Switcher Pills */}
        <div className="navbar-quick-tabs">
          <button
            type="button"
            className={`navbar-tab-btn ${currentTab === 'inbox' ? 'active' : ''}`}
            onClick={() => onTabChange?.('inbox')}
          >
            Hộp thư Chat
          </button>
          <button
            type="button"
            className={`navbar-tab-btn ${currentTab === 'onboarding' ? 'active' : ''}`}
            onClick={() => onTabChange?.('onboarding')}
          >
            Onboarding Kênh
          </button>
          <button
            type="button"
            className={`navbar-tab-btn ${currentTab === 'import' ? 'active' : ''}`}
            onClick={() => onTabChange?.('import')}
          >
            Bảng tính CSV
          </button>
        </div>

        <div className="crm-status-pill">
          <span className="crm-status-dot online"></span>
          <Server size={14} />
          <span>API: <code>{apiUrl}</code></span>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowConfig(!showConfig)}
          title="Cấu hình kết nối Backend API"
        >
          <SlidersHorizontal size={14} />
          <span>API Config</span>
        </button>

        {showConfig && (
          <div className="crm-config-popover">
            <div className="popover-title">Đổi địa chỉ API Backend</div>
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
                <span>Lưu cấu hình</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
