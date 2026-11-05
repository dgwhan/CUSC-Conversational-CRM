import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  ShieldAlert,
  ExternalLink,
  Trash2,
  X,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client/index.js';
import type { NotificationItem, NotificationSeverity } from '../../lib/api-client/index.js';
import { useRealtime } from '../realtime/RealtimeContext.js';
import { useWorkspaceConfig } from '../workspace/WorkspaceConfigContext.js';
import type { ActiveNavTab } from '../../app/Sidebar.js';

interface NotificationCenterProps {
  onNavigateTab?: (tab: ActiveNavTab) => void;
}

function getRelativeTimeString(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Hôm qua';
    if (days < 30) return `${days} ngày trước`;
    return new Date(dateStr).toLocaleDateString('vi-VN');
  } catch {
    return 'Vừa xong';
  }
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onNavigateTab }) => {
  const { onNotification } = useRealtime();
  const { activeWorkspaceId } = useWorkspaceConfig();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveWsId = activeWorkspaceId || apiClient.getActiveWorkspaceId() || 'ws-default-001';

  // Tải danh sách thông báo từ API
  const fetchNotifications = useCallback(async () => {
    if (!effectiveWsId) return;
    setIsLoading(true);
    try {
      const res = await apiClient.getNotifications(effectiveWsId, { limit: 30 });
      if (res && Array.isArray(res.items)) {
        setNotifications(res.items);
        setUnreadCount(res.unreadCount || res.items.filter((n) => !n.isRead).length);
      }
    } catch (err) {
      console.warn('Lỗi khi tải thông báo:', err);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveWsId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Lắng nghe sự kiện realtime notification:new
  useEffect(() => {
    const unsubscribe = onNotification((newNotif: NotificationItem) => {
      setNotifications((prev) => {
        // Tránh trùng lặp
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });
      setUnreadCount((prev) => prev + 1);
    });

    return () => unsubscribe();
  }, [onNotification]);

  // Đóng popover khi nhấp ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Đánh dấu 1 thông báo là đã đọc
  const handleMarkAsRead = async (item: NotificationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (item.isRead) return;

    try {
      await apiClient.markNotificationRead(effectiveWsId, item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('Lỗi markNotificationRead:', err);
    }
  };

  // Đánh dấu tất cả là đã đọc
  const handleMarkAllAsRead = async () => {
    try {
      await apiClient.markAllNotificationsRead(effectiveWsId);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Lỗi markAllNotificationsRead:', err);
    }
  };

  // Xóa thông báo
  const handleDeleteNotification = async (item: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.deleteNotification(effectiveWsId, item.id);
      setNotifications((prev) => prev.filter((n) => n.id !== item.id));
      if (!item.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.warn('Lỗi deleteNotification:', err);
    }
  };

  // Chuyển hướng khi click vào thông báo
  const handleItemClick = (item: NotificationItem) => {
    handleMarkAsRead(item);
    setIsOpen(false);

    if (item.actionUrl) {
      if (item.actionUrl.includes('channels') || item.actionUrl.includes('onboarding')) {
        if (onNavigateTab) {
          onNavigateTab('onboarding');
        } else {
          window.location.hash = '#onboarding';
        }
      } else if (item.actionUrl.includes('inbox')) {
        if (onNavigateTab) {
          onNavigateTab('inbox');
        } else {
          window.location.hash = '#inbox';
        }
      } else if (item.actionUrl.startsWith('/')) {
        window.location.hash = item.actionUrl.replace(/^\//, '#');
      }
    }
  };

  const getSeverityBadge = (severity: NotificationSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          icon: <ShieldAlert size={16} className="text-red-500" />,
          bg: 'bg-red-50/50 border-l-2 border-l-red-500',
          badgeClass: 'bg-red-100 text-red-700 border border-red-200',
          label: 'Nguy cấp',
        };
      case 'URGENT':
        return {
          icon: <AlertCircle size={16} className="text-orange-500" />,
          bg: 'bg-orange-50/50 border-l-2 border-l-orange-500',
          badgeClass: 'bg-orange-100 text-orange-700 border border-orange-200',
          label: 'Khẩn cấp',
        };
      case 'WARNING':
        return {
          icon: <AlertTriangle size={16} className="text-amber-500" />,
          bg: 'bg-amber-50/50 border-l-2 border-l-amber-500',
          badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200',
          label: 'Cảnh báo',
        };
      case 'INFO':
      default:
        return {
          icon: <Info size={16} className="text-blue-500" />,
          bg: 'bg-blue-50/40 border-l-2 border-l-blue-500',
          badgeClass: 'bg-blue-100 text-blue-700 border border-blue-200',
          label: 'Thông tin',
        };
    }
  };

  const filteredNotifications =
    filter === 'UNREAD' ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      {/* Icon Chuông thông báo trên Header: Bỏ viền, số đếm đặt ở góc trên bên phải */}
      <button
        type="button"
        className={`relative w-8 h-8 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
          isOpen
            ? 'bg-slate-100 text-slate-900'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
        }`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        title="Thông báo"
        aria-label="Thông báo"
      >
        <Bell size={17} className={unreadCount > 0 ? 'text-slate-700' : 'text-slate-500'} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center ring-2 ring-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover / Dropdown Hộp thông báo chuẩn Light Theme CRM */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[580px] animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Bell size={15} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-slate-800 text-xs">
                    Thông báo Workspace
                  </h3>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 text-[11px] font-semibold bg-red-100 text-red-600 rounded-full">
                      {unreadCount} mới
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 truncate">Kênh liên kết & hội thoại</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline flex items-center gap-1 px-1.5 py-1 rounded hover:bg-blue-50 transition-colors"
                  title="Đánh dấu tất cả là đã đọc"
                >
                  <CheckCheck size={13} />
                  <span>Đọc tất cả</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
                title="Đóng"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-4 py-1.5 bg-slate-50/60 border-b border-slate-200 flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filter === 'ALL'
                  ? 'bg-white text-blue-600 shadow-xs border border-slate-200 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('UNREAD')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filter === 'UNREAD'
                  ? 'bg-white text-blue-600 shadow-xs border border-slate-200 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>

          {/* List items */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100 bg-white">
            {isLoading && notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <div className="inline-block animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full mb-2"></div>
                <div>Đang tải thông báo...</div>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-10 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <Bell size={22} />
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  Không có thông báo nào
                </p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[240px] mx-auto leading-relaxed">
                  Mọi cập nhật về trạng thái kênh và khách hàng sẽ xuất hiện tại đây.
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const config = getSeverityBadge(item.severity);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3.5 transition-colors cursor-pointer relative group flex gap-3 ${
                      item.isRead
                        ? 'bg-white hover:bg-slate-50'
                        : `${config.bg} hover:brightness-98`
                    }`}
                  >
                    {/* Severity Icon */}
                    <div className="shrink-0 mt-0.5">{config.icon}</div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded ${config.badgeClass}`}
                        >
                          {config.label}
                        </span>
                        <h4
                          className={`text-xs truncate ${
                            item.isRead ? 'text-slate-700 font-medium' : 'text-slate-900 font-bold'
                          }`}
                          title={item.title}
                        >
                          {item.title}
                        </h4>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {item.content}
                      </p>

                      <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                        <span>{getRelativeTimeString(item.createdAt)}</span>
                        {item.actionUrl && (
                          <span className="inline-flex items-center gap-0.5 text-blue-600 font-medium hover:underline">
                            <span>Chi tiết</span>
                            <ExternalLink size={10} />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Unread dot / Actions */}
                    <div className="absolute right-3 top-3 flex items-center gap-1">
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="Chưa đọc" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteNotification(item, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-opacity"
                        title="Xóa thông báo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-center">
              <span className="text-[11px] text-slate-400">
                Hiển thị {filteredNotifications.length} thông báo gần nhất
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
