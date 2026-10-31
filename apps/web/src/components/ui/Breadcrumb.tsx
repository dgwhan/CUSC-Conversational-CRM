import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  href?: string;
  isCurrent?: boolean;
  icon?: React.ReactNode;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  showBackArrow?: boolean;
  onBack?: () => void;
}

/**
 * Root System Breadcrumb Component
 * Căn chỉnh thẳng hàng 100% theo trục ngang giữa icon và text, hỗ trợ tái sử dụng toàn hệ thống
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  className = '',
  showBackArrow = true,
  onBack,
}) => {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 text-xs text-slate-500 font-medium select-none ${className}`}
    >
      {items.map((item, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === items.length - 1;
        const isCurrent = item.isCurrent ?? isLast;

        return (
          <React.Fragment key={idx}>
            {/* Dấu phân cách giữa các cấp breadcrumb */}
            {idx > 0 && (
              <span className="flex items-center text-slate-400 shrink-0">
                <ChevronRight size={13} className="block shrink-0" />
              </span>
            )}

            {/* Mục hiện tại (Trang hiện hành - không click) */}
            {isCurrent ? (
              <span
                className="flex items-center leading-none text-slate-900 font-semibold truncate max-w-[320px]"
                aria-current="page"
              >
                {item.icon && <span className="flex items-center mr-1 shrink-0">{item.icon}</span>}
                <span className="leading-none">{item.label}</span>
              </span>
            ) : item.onClick || (isFirst && onBack) ? (
              /* Mục có thể click (Link / Action) */
              <button
                type="button"
                onClick={item.onClick || (isFirst ? onBack : undefined)}
                className="flex items-center gap-1 leading-none text-slate-500 hover:text-blue-600 transition-colors bg-transparent border-none p-0 cursor-pointer font-medium outline-none"
              >
                {/* Mũi tên quay lại ở mục đầu tiên */}
                {isFirst && showBackArrow && (
                  <ChevronLeft size={14} className="block shrink-0 text-slate-500 group-hover:text-blue-600" />
                )}
                {item.icon && <span className="flex items-center mr-1 shrink-0">{item.icon}</span>}
                <span className="leading-none">{item.label}</span>
              </button>
            ) : item.href ? (
              /* Đường dẫn HTML thẻ a */
              <a
                href={item.href}
                className="flex items-center gap-1 leading-none text-slate-500 hover:text-blue-600 transition-colors no-underline font-medium"
              >
                {isFirst && showBackArrow && (
                  <ChevronLeft size={14} className="block shrink-0 text-slate-500" />
                )}
                {item.icon && <span className="flex items-center mr-1 shrink-0">{item.icon}</span>}
                <span className="leading-none">{item.label}</span>
              </a>
            ) : (
              /* Nhãn văn bản thông thường */
              <span className="flex items-center gap-1 leading-none text-slate-500 font-medium">
                {isFirst && showBackArrow && (
                  <ChevronLeft size={14} className="block shrink-0 text-slate-500" />
                )}
                {item.icon && <span className="flex items-center mr-1 shrink-0">{item.icon}</span>}
                <span className="leading-none">{item.label}</span>
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
