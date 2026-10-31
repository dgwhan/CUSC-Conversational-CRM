import React, { type ReactNode } from 'react';

export interface PageSectionProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  hasDivider?: boolean;
  variant?: 'flat' | 'bordered' | 'subtle';
}

/**
 * Standard Global Page Section Component
 * Flat Design, functional spacing, separates content cleanly without heavy shadows
 */
export const PageSection: React.FC<PageSectionProps> = ({
  title,
  subtitle,
  actions,
  children,
  className = '',
  hasDivider = false,
  variant = 'flat',
}) => {
  const variantClasses: Record<string, string> = {
    flat: 'bg-transparent',
    bordered: 'border border-slate-200 bg-white p-4 sm:p-5',
    subtle: 'bg-slate-50 border border-slate-200 p-4 sm:p-5',
  };

  return (
    <section className={`page-section flex flex-col ${variantClasses[variant] ?? ''} ${hasDivider ? 'pb-6 border-b border-slate-200' : ''} ${className}`}>
      {(title || subtitle || actions) && (
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div className="flex flex-col gap-0.5">
            {title && (
              <h3 className="text-xs sm:text-[13px] font-bold text-slate-800 uppercase tracking-wider m-0">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 m-0">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {children}
    </section>
  );
};
