import React, { useState } from 'react';
import { Server, ChevronRight, SlidersHorizontal, Check } from 'lucide-react';
import { apiClient } from '../lib/api-client.js';

interface NavbarProps {
  onApiUrlChange?: (newUrl: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onApiUrlChange }) => {
  const [showConfig, setShowConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState(apiClient.getBaseUrl());

  const handleSaveApi = () => {
    apiClient.setBaseUrl(apiUrl);
    if (onApiUrlChange) onApiUrlChange(apiUrl);
    setShowConfig(false);
  };

  return (
    <header className="crm-navbar">
      <div className="crm-breadcrumb">
        <span className="crumb-root">Hệ thống CRM</span>
        <ChevronRight size={14} className="crumb-separator" />
        <span className="crumb-module">Giao tiếp Đa kênh</span>
        <ChevronRight size={14} className="crumb-separator" />
        <span className="crumb-current">Nhập tay & Import CSV (MSG-06)</span>
      </div>

      <div className="crm-navbar-actions">
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
          <span>Kết nối API</span>
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
                  Port 3000
                </button>
              </div>
            </div>
            <div className="popover-footer">
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveApi}
              >
                <Check size={14} />
                <span>Áp dụng</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
