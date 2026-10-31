import React from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  count?: number | null;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
  tabClassName?: string;
  borderBottom?: boolean;
}

/**
 * Tabs - Component Tab phẳng dùng chung toàn hệ thống (System Root Component)
 * Tuân thủ design system: Không bo góc (rounded-none), phẳng, tương phản rõ nét.
 */
export const Tabs = <T extends string = string>({
  items,
  activeTab,
  onChange,
  className = '',
  tabClassName = '',
  borderBottom = true,
}: TabsProps<T>): React.ReactElement => {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-8 text-sm ${
        borderBottom ? 'border-b border-slate-200' : ''
      } ${className}`}
    >
      {items.map((tab) => {
        const isActive = activeTab === tab.id;
        const isDisabled = Boolean(tab.disabled);

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange(tab.id)}
            className={`pb-3 font-semibold transition-colors bg-transparent border-none cursor-pointer text-sm flex items-center gap-1.5 outline-none ${
              isActive
                ? 'text-blue-600 border-b-2 border-blue-600 -mb-[1px]'
                : isDisabled
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-500 hover:text-slate-800'
            } ${tabClassName}`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count !== null && (
              <span
                className={`text-xs px-1.5 py-0.2 rounded-none ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 font-bold'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            )}
            {tab.badge && <span className="ml-0.5">{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
};
