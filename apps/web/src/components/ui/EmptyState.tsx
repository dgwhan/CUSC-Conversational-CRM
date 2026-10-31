import React, { type ReactNode } from 'react';
import { Search } from 'lucide-react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  isDashed?: boolean;
}

/**
 * Global Empty State Component for tables, lists, and search queries
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
  isDashed = true,
}) => {
  return (
    <div
      className={`empty-state w-full py-12 px-6 text-center bg-slate-50/60 rounded-none flex flex-col items-center justify-center gap-3 ${
        isDashed ? 'border border-dashed border-slate-300' : 'border border-slate-200'
      } ${className}`}
    >
      <div className="text-slate-400">
        {icon || <Search size={28} className="mx-auto" />}
      </div>

      <div className="flex flex-col gap-1 max-w-md mx-auto">
        <h4 className="text-sm font-semibold text-slate-800 m-0">
          {title}
        </h4>
        {description && (
          <p className="text-xs text-slate-500 m-0 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};
