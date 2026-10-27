import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check, Shield, UserCheck, Layers, RefreshCw } from 'lucide-react';
import { useWorkspaceConfig } from './WorkspaceConfigContext.js';
import './WorkspaceSwitcher.css';

export const WorkspaceSwitcher: React.FC = () => {
  const {
    myWorkspaces,
    activeWorkspaceId,
    activeWorkspace,
    isCurrentWorkspaceOwner,
    switchWorkspace,
    fetchMyWorkspaces,
    isLoading,
  } = useWorkspaceConfig();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = async (wsId: string) => {
    setIsOpen(false);
    if (wsId !== activeWorkspaceId) {
      await switchWorkspace(wsId);
    }
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetchMyWorkspaces();
  };

  const currentDisplayName = activeWorkspace?.name || 'Workspace';

  return (
    <div className="ws-switcher-container" ref={dropdownRef}>
      <button
        type="button"
        className={`ws-switcher-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Bấm để chuyển đổi Không gian làm việc (Workspace)"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="ws-switcher-icon-wrap">
          <Building2 size={15} className="ws-icon" />
        </div>

        <div className="ws-switcher-info">
          <span className="ws-switcher-name" title={currentDisplayName}>
            {currentDisplayName}
          </span>
          <span className={`ws-badge ${isCurrentWorkspaceOwner ? 'badge-owner' : 'badge-staff'}`}>
            {isCurrentWorkspaceOwner ? 'Chủ sở hữu' : 'Thành viên'}
          </span>
        </div>

        <ChevronDown size={14} className={`ws-chevron ${isOpen ? 'rotate' : ''}`} />
      </button>

      {isOpen && (
        <div className="ws-dropdown-menu">
          <div className="ws-dropdown-header">
            <div className="ws-header-title">
              <Layers size={14} />
              <span>Không Gian Làm Việc ({myWorkspaces.length})</span>
            </div>
            <button
              type="button"
              className="ws-refresh-btn"
              onClick={handleRefresh}
              title="Tải lại danh sách Workspace"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="ws-list">
            {myWorkspaces.length === 0 ? (
              <div className="ws-empty-hint">Không có workspace nào khả dụng</div>
            ) : (
              myWorkspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    className={`ws-item ${isActive ? 'selected' : ''}`}
                    onClick={() => handleSelect(ws.id)}
                  >
                    <div className="ws-item-left">
                      <div className="ws-item-avatar">
                        {ws.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="ws-item-details">
                        <div className="ws-item-name" title={ws.name}>
                          {ws.name}
                        </div>
                        <div className="ws-item-sub">
                          <span className={`ws-role-tag ${ws.isOwner ? 'owner' : 'staff'}`}>
                            {ws.isOwner ? (
                              <>
                                <Shield size={10} /> Owner
                              </>
                            ) : (
                              <>
                                <UserCheck size={10} /> Member
                              </>
                            )}
                          </span>
                          {ws.ownerName && (
                            <span className="ws-owner-text" title={`Chủ sở hữu: ${ws.ownerName}`}>
                              • {ws.ownerName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <div className="ws-item-check" title="Đang kích hoạt">
                        <Check size={15} />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="ws-dropdown-footer">
            <span className="ws-footer-tip">
              Mẹo: Khi được mời vào Workspace khác, bạn có thể chuyển đổi nhanh tại đây mà không cần đăng xuất.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
