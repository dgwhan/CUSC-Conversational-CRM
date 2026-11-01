import React, { useState, useEffect } from 'react';
import { Clock, RotateCcw, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ZaloTokenCountdownProps {
  tokenExpiresAt?: string | null;
  disconnectedAt?: string | null;
  isActive: boolean;
  onRenew: () => void;
  compact?: boolean;
}

export const ZaloTokenCountdown: React.FC<ZaloTokenCountdownProps> = ({
  tokenExpiresAt,
  disconnectedAt,
  isActive,
  onRenew,
  compact = false,
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    isExpired: boolean;
    totalHoursLeft: number;
  }>({ hours: 0, minutes: 0, isExpired: false, totalHoursLeft: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!tokenExpiresAt || !isActive || disconnectedAt) {
        setTimeLeft({ hours: 0, minutes: 0, isExpired: true, totalHoursLeft: 0 });
        return;
      }

      const diff = new Date(tokenExpiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, isExpired: true, totalHoursLeft: 0 });
        return;
      }

      const totalHoursLeft = diff / (1000 * 60 * 60);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft({ hours, minutes, isExpired: false, totalHoursLeft });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 30000); // cập nhật mỗi 30s
    return () => clearInterval(interval);
  }, [tokenExpiresAt, isActive, disconnectedAt]);

  const { hours, minutes, isExpired, totalHoursLeft } = timeLeft;

  // Tổng thời gian phiên chuẩn 72 giờ
  const totalDurationMs = 72 * 60 * 60 * 1000;
  const currentDiff = tokenExpiresAt ? Math.max(0, new Date(tokenExpiresAt).getTime() - Date.now()) : 0;
  const progressPercent = Math.max(0, Math.min(100, Math.round((currentDiff / totalDurationMs) * 100)));

  // Phân loại màu sắc theo mức độ thời hạn
  const isUrgent = totalHoursLeft < 2; // < 2 giờ -> ĐỎ
  const isWarning = totalHoursLeft < 12; // < 12 giờ -> VÀNG
  // >= 12 giờ -> XANH

  let statusColor: 'emerald' | 'amber' | 'red' = 'emerald';
  let badgeText = `Còn: ${hours} giờ ${minutes} phút`;
  let StatusIcon = CheckCircle2;

  if (isExpired || !isActive || disconnectedAt) {
    statusColor = 'red';
    badgeText = 'Phiên đã hết hạn (Cần quét lại)';
    StatusIcon = AlertCircle;
  } else if (isUrgent) {
    statusColor = 'red';
    badgeText = `Khẩn cấp: Còn ${hours > 0 ? `${hours}h ` : ''}${minutes} phút`;
    StatusIcon = AlertCircle;
  } else if (isWarning) {
    statusColor = 'amber';
    badgeText = `Sắp hết: Còn ${hours} giờ ${minutes} phút`;
    StatusIcon = AlertTriangle;
  }

  const colorStylesMap = {
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-800/60',
      text: 'text-emerald-700 dark:text-emerald-300',
      bar: 'bg-emerald-500',
      subtext: 'text-emerald-600 dark:text-emerald-400',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-800/60',
      text: 'text-amber-700 dark:text-amber-300',
      bar: 'bg-amber-500',
      subtext: 'text-amber-600 dark:text-amber-400',
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-950/40',
      border: 'border-red-200 dark:border-red-800/60',
      text: 'text-red-700 dark:text-red-300',
      bar: 'bg-red-500',
      subtext: 'text-red-600 dark:text-red-400',
    },
  };
  const colorStyles = colorStylesMap[statusColor];

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${colorStyles.bg} ${colorStyles.border} ${colorStyles.text}`}>
        <StatusIcon size={13} className={isUrgent || isExpired ? 'animate-pulse' : ''} />
        <span>{badgeText}</span>
        <button
          type="button"
          onClick={onRenew}
          className="ml-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-white dark:bg-gray-800 shadow-2xs hover:bg-slate-100 transition-colors"
          title="Gia hạn ngay phiên Zalo"
        >
          Gia hạn
        </button>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-lg border ${colorStyles.bg} ${colorStyles.border} mt-2.5 max-w-md`}>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-1.5">
          <Clock size={14} className={colorStyles.text} />
          <span className={`text-xs font-bold ${colorStyles.text}`}>
            Thời hạn phiên Zalo cá nhân (72h)
          </span>
        </div>
        <button
          type="button"
          onClick={onRenew}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-all shadow-xs cursor-pointer active:scale-95"
          title="Làm mới phiên Zalo bất cứ lúc nào trước khi hết hạn"
        >
          <RotateCcw size={12} />
          <span>Gia hạn ngay</span>
        </button>
      </div>

      {/* Thanh tiến trình thời gian trực quan */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden my-1.5">
        <div
          className={`h-full transition-all duration-500 rounded-full ${colorStyles.bar}`}
          style={{ width: `${isExpired ? 0 : progressPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] mt-1">
        <span className={`font-semibold flex items-center gap-1 ${colorStyles.subtext}`}>
          <StatusIcon size={12} />
          {badgeText}
        </span>
        <span className="text-slate-400 dark:text-slate-500">
          Tiến trình: {isExpired ? 0 : progressPercent}%
        </span>
      </div>
    </div>
  );
};
