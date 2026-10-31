import React from 'react';
import {
  type ConnectionStatus,
  CONNECTION_STATUS_LABELS,
} from '../../modules/onboarding/components/workspace/workspace.config.js';

export interface StatusBadgeProps {
  status: ConnectionStatus;
  showDot?: boolean;
  className?: string;
  label?: string;
}

/**
 * Component hiển thị Badge trạng thái kết nối chuẩn hệ thống
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'Disconnected',
  showDot = true,
  className = '',
  label,
}) => {
  const statusKey = (status || 'disconnected').toLowerCase();
  const text = label || CONNECTION_STATUS_LABELS[status] || status;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold border rounded-none badge-status-${statusKey} ${className}`.trim()}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 dot-status-${statusKey}`} />}
      <span>{text}</span>
    </span>
  );
};
