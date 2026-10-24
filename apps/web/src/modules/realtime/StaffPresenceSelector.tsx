import React, { useState, useRef, useEffect } from 'react';
import { useRealtime } from './RealtimeContext.js';
import type { StaffPresenceStatus } from '../inbox/types.js';
import { ChevronDown, Wifi, WifiOff, Volume2, VolumeX, BellRing } from 'lucide-react';

export const StaffPresenceSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const {
    myPresence,
    updateMyPresence,
    connectionStatus,
    soundActive,
    setSoundActive,
    simulateIncomingMessage,
  } = useRealtime();

  const [isOpen, setIsOpen] = useState(false);
  const [showSimulateMenu, setShowSimulateMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const statusConfig: Record<
    StaffPresenceStatus,
    { label: string; desc: string; color: string; bg: string; dotClass: string }
  > = {
    ONLINE: {
      label: 'Trực tuyến',
      desc: 'Sẵn sàng tiếp nhận tư vấn',
      color: '#10b981',
      bg: '#ecfdf5',
      dotClass: 'presence-dot-online',
    },
    AWAY: {
      label: 'Vắng mặt',
      desc: 'Tạm rời bàn làm việc / Nghỉ trưa',
      color: '#f59e0b',
      bg: '#fffbeb',
      dotClass: 'presence-dot-away',
    },
    BUSY: {
      label: 'Đang bận',
      desc: 'Đang gọi tư vấn tuyển sinh / Họp',
      color: '#ef4444',
      bg: '#fef2f2',
      dotClass: 'presence-dot-busy',
    },
  };

  const current = statusConfig[myPresence];

  // Đóng popover khi nhấp ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowSimulateMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (status: StaffPresenceStatus) => {
    updateMyPresence(status);
    setIsOpen(false);
  };

  return (
    <div className="staff-presence-wrapper" ref={containerRef}>
      {/* Nút bật tắt âm thanh Ting ting */}
      <button
        type="button"
        className={`presence-sound-toggle-btn ${soundActive ? 'active' : 'muted'}`}
        onClick={() => setSoundActive(!soundActive)}
        title={soundActive ? 'Chuông thông báo Ting ting đang bật' : 'Chuông thông báo đang tắt'}
      >
        {soundActive ? <Volume2 size={15} /> : <VolumeX size={15} />}
      </button>

      {/* Nút chính hiển thị trạng thái nhân viên */}
      <button
        type="button"
        className="staff-presence-button"
        style={{ backgroundColor: current.bg, borderColor: `${current.color}40` }}
        onClick={() => setIsOpen(!isOpen)}
        title="Bấm để đổi trạng thái trực tuyến của bạn"
      >
        <span
          className="presence-status-dot"
          style={{ backgroundColor: current.color }}
        />
        {!compact && (
          <span className="presence-status-label" style={{ color: current.color }}>
            {current.label}
          </span>
        )}
        <ChevronDown size={13} style={{ color: current.color }} />
      </button>

      {/* Menu dropdown chọn trạng thái */}
      {isOpen && (
        <div className="staff-presence-dropdown">
          <div className="presence-dropdown-header">
            <span className="dropdown-title">Trạng thái nhân viên</span>
            <span
              className={`connection-pill ${connectionStatus.toLowerCase()}`}
              title={
                connectionStatus === 'CONNECTED'
                  ? 'Máy chủ SSE thời gian thực đang kết nối'
                  : 'Đang thử kết nối lại với SSE Server'
              }
            >
              {connectionStatus === 'CONNECTED' ? <Wifi size={11} /> : <WifiOff size={11} />}
              <span>{connectionStatus === 'CONNECTED' ? 'Realtime Live' : 'Offline / Sim'}</span>
            </span>
          </div>

          <div className="presence-options-list">
            {(Object.keys(statusConfig) as StaffPresenceStatus[]).map((statusKey) => {
              const cfg = statusConfig[statusKey];
              const isSelected = myPresence === statusKey;
              return (
                <button
                  key={statusKey}
                  type="button"
                  className={`presence-option-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(statusKey)}
                >
                  <span
                    className="presence-status-dot"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <div className="presence-option-text">
                    <span className="option-label">{cfg.label}</span>
                    <span className="option-desc">{cfg.desc}</span>
                  </div>
                  {isSelected && <span className="presence-check-mark">✓</span>}
                </button>
              );
            })}
          </div>

          <div className="presence-dropdown-footer">
            <button
              type="button"
              className="quick-simulate-btn"
              onClick={() => setShowSimulateMenu(!showSimulateMenu)}
            >
              <BellRing size={13} />
              <span>Thử bắn tin nhắn Realtime...</span>
            </button>

            {showSimulateMenu && (
              <div className="simulate-sub-actions">
                <button
                  type="button"
                  className="sub-sim-btn fb"
                  onClick={() => {
                    simulateIncomingMessage('FACEBOOK');
                    setIsOpen(false);
                  }}
                >
                  📩 Giả lập Messenger
                </button>
                <button
                  type="button"
                  className="sub-sim-btn zalo"
                  onClick={() => {
                    simulateIncomingMessage('ZALO');
                    setIsOpen(false);
                  }}
                >
                  💬 Giả lập Zalo OA
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
