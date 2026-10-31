import React, { type ReactNode } from 'react';

export interface PageToolbarProps {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  metaText?: ReactNode;
  className?: string;
}

/**
 * Standard Global Page Toolbar Component for Lists and Data Management
 * Harmonizes Search, Filters, and Primary Action Buttons
 */
export const PageToolbar: React.FC<PageToolbarProps> = ({
  search,
  filters,
  actions,
  metaText,
  className = '',
}) => {
  return (
    <div className={`page-toolbar flex flex-col gap-2.5 mb-4 ${className}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Search & Filter Controls */}
        {(search || filters) && (
          <div className="flex items-center gap-2.5 flex-1 min-w-[280px] flex-wrap">
            {search && <div className={`flex-1 min-w-[200px] ${filters ? 'max-w-md' : 'max-w-xl'}`}>{search}</div>}
            {filters && <div className="flex items-center gap-2 flex-wrap">{filters}</div>}
          </div>
        )}

        {/* Right: Actions */}
        {actions && (
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {actions}
          </div>
        )}
      </div>

      {/* Optional Meta / Counter line */}
      {metaText && (
        <div className="flex items-center justify-between text-xs text-slate-500 px-0.5">
          {metaText}
        </div>
      )}
    </div>
  );
};
