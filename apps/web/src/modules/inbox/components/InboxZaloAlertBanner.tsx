import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, AlertTriangle, RotateCcw, X, QrCode } from 'lucide-react';
import { apiClient } from '../../../lib/api-client.js';
import { useRealtime } from '../../realtime/RealtimeContext.js';

interface InboxZaloAlertBannerProps {
  onOpenRenewModal?: () => void;
}

interface ZaloAccountStatus {
  id: string;
  displayName: string;
  isActive: boolean;
  tokenExpiresAt: string | null;
  disconnectedAt: string | null;
  remainingHours: number;
  isExpiringSoon: boolean; // < 2 giờ
  isDisconnectedOrExpired: boolean;
}

export const InboxZaloAlertBanner: React.FC<InboxZaloAlertBannerProps> = ({ onOpenRenewModal }) => {
  const { onNotification } = useRealtime();
  const [zaloStatus, setZaloStatus] = useState<ZaloAccountStatus | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const checkZaloChannel = useCallback(async () => {
    try {
      const channels = await apiClient.getChannels();
      if (!Array.isArray(channels)) return;

      const zalo = (channels as any[]).find((ch: any) => {
        if (ch.channel !== 'ZALO') return false;
        const meta = ch.metadata || {};
        return meta.isPersonal === true || meta.engine === 'zca-js' || ch.tokenExpiresAt;
      });

      if (!zalo) {
        setZaloStatus(null);
        return;
      }

      const now = Date.now();
      let remainingHours = 72;
      let isExpired = false;

      if (zalo.tokenExpiresAt) {
        const diff = new Date(String(zalo.tokenExpiresAt)).getTime() - now;
        remainingHours = diff / (1000 * 60 * 60);
        if (diff <= 0) isExpired = true;
      }

      const isDisconnectedOrExpired = !zalo.isActive || Boolean(zalo.disconnectedAt) || isExpired;
      const isExpiringSoon = !isDisconnectedOrExpired && remainingHours <= 2;

      if (isDisconnectedOrExpired || isExpiringSoon) {
        setZaloStatus({
          id: String(zalo.id),
          displayName: String(zalo.displayName || 'Zalo Cá nhân'),
          isActive: Boolean(zalo.isActive),
          tokenExpiresAt: zalo.tokenExpiresAt ? String(zalo.tokenExpiresAt) : null,
          disconnectedAt: zalo.disconnectedAt ? String(zalo.disconnectedAt) : null,
          remainingHours: Math.max(0, remainingHours),
          isExpiringSoon,
          isDisconnectedOrExpired,
        });
        setIsDismissed(false);
      } else {
        setZaloStatus(null);
      }
    } catch {
      // Backend offline hoặc lỗi mạng thì bỏ qua
    }
  }, []);

  useEffect(() => {
    checkZaloChannel();
    const interval = setInterval(checkZaloChannel, 60000); // kiểm tra mỗi 1 phút
    return () => clearInterval(interval);
  }, [checkZaloChannel]);

  // Cập nhật ngay khi nhận sự kiện realtime liên quan đến Zalo
  useEffect(() => {
    const unsub = onNotification((notif) => {
      if (notif.type === 'CHANNEL_EXPIRING' || notif.type === 'CHANNEL_EXPIRED') {
        checkZaloChannel();
      }
    });
    return () => unsub();
  }, [onNotification, checkZaloChannel]);

  if (!zaloStatus || isDismissed) return null;

  const handleAction = () => {
    if (onOpenRenewModal) {
      onOpenRenewModal();
    } else {
      window.location.hash = '#onboarding';
    }
  };

  if (zaloStatus.isDisconnectedOrExpired) {
    return (
      <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-xs shadow-md z-20 shrink-0 animate-in fade-in duration-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <AlertCircle size={18} className="shrink-0 text-white animate-pulse" />
          <div className="min-w-0">
            <span className="font-bold uppercase tracking-wider text-[11px] bg-red-800/80 px-2 py-0.5 rounded-full mr-2">
              Khẩn cấp
            </span>
            <span className="font-medium">
              Tài khoản Zalo cá nhân <strong>"{zaloStatus.displayName}"</strong> đã bị ngắt kết nối hoặc hết hạn phiên 72 giờ! Bạn sẽ không thể nhận tin nhắn mới từ khách hàng.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleAction}
            className="flex items-center gap-1.5 px-3 py-1 bg-white text-red-700 font-bold rounded-md hover:bg-red-50 transition-colors shadow-xs text-xs cursor-pointer active:scale-95"
            title="Quét lại mã QR để khôi phục phiên kết nối"
          >
            <QrCode size={13} />
            <span>Quét lại mã ngay</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1 text-white/80 hover:text-white rounded hover:bg-white/10 transition-colors"
            title="Tạm ẩn cảnh báo"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  // Cảnh báo màu vàng (< 2h)
  const minutesLeft = Math.max(1, Math.round(zaloStatus.remainingHours * 60));

  return (
    <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 py-2 flex items-center justify-between gap-3 text-xs shadow-sm z-20 shrink-0 animate-in fade-in duration-200">
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertTriangle size={17} className="shrink-0 text-amber-100 animate-bounce" />
        <div className="min-w-0">
          <span className="font-bold uppercase tracking-wider text-[11px] bg-amber-700/80 px-2 py-0.5 rounded-full mr-2">
            Cảnh báo thời hạn
          </span>
          <span className="font-medium">
            Phiên Zalo cá nhân <strong>"{zaloStatus.displayName}"</strong> chỉ còn <strong>{minutesLeft} phút</strong>. Hãy gia hạn ngay để tránh gián đoạn hội thoại!
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleAction}
          className="flex items-center gap-1.5 px-3 py-1 bg-white text-amber-700 font-bold rounded-md hover:bg-amber-50 transition-colors shadow-xs text-xs cursor-pointer active:scale-95"
          title="Gia hạn ngay phiên Zalo"
        >
          <RotateCcw size={13} />
          <span>Gia hạn ngay</span>
        </button>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 text-white/80 hover:text-white rounded hover:bg-white/10 transition-colors"
          title="Tạm ẩn cảnh báo"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
