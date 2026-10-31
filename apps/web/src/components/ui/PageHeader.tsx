import React, { type ReactNode } from 'react';
import { Breadcrumb, type BreadcrumbItem } from './Breadcrumb.js';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  onBack?: () => void;
  badges?: ReactNode;
  actions?: ReactNode;
  className?: string;
  hasDivider?: boolean;
}

/**
 * Standard Global Page Header for Enterprise SaaS Layout
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  onBack,
  badges,
  actions,
  className = '',
  hasDivider = true,
}) => {
  return (
    <div className={`page-header w-full ${hasDivider ? 'pb-5 border-b border-slate-200' : ''} ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb
          className="mb-3.5"
          showBackArrow={Boolean(onBack)}
          items={breadcrumbs}
        />
      )}

      <div className="flex items-start justify-between flex-wrap gap-4">
        {/* Left: Title, Description & Badges */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-[22px] font-bold text-slate-900 tracking-tight m-0">
              {title}
            </h1>
            {badges && <div className="flex items-center gap-1.5 flex-wrap">{badges}</div>}
          </div>
          {description && (
            <p className="text-xs sm:text-[13px] text-slate-500 m-0 mt-0.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Right: Actions */}
        {actions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
