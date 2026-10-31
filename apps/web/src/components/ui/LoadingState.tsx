import React, { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Global Loading State Component for data fetching and tab switching
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Đang tải dữ liệu...',
  size = 'md',
  className = '',
}) => {
  const spinnerSizes: Record<string, number> = {
    sm: 16,
    md: 20,
    lg: 28,
  };

  const textSizes: Record<string, string> = {
    sm: 'text-[11px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  return (
    <div
      className={`loading-state flex items-center justify-center py-12 text-slate-500 gap-2.5 ${textSizes[size] ?? 'text-xs'} ${className}`}
    >
      <Loader2 size={spinnerSizes[size] ?? 20} className="animate-spin text-blue-600 shrink-0" />
      {message && <span>{message}</span>}
    </div>
  );
};
