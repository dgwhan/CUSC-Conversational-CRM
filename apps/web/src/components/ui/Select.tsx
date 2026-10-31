import React, { type SelectHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: ReactNode;
  options?: SelectOption[];
  error?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

/**
 * Standard Global Flat Select Component
 */
export const Select: React.FC<SelectProps> = ({
  label,
  options,
  error,
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...props
}) => {
  const heightClasses: Record<string, string> = {
    sm: 'py-1 pl-2.5 pr-7 text-[12px] h-[30px]',
    md: 'py-1.5 pl-3 pr-8 text-xs h-[36px]',
    lg: 'py-2 pl-3.5 pr-9 text-sm h-[42px]',
  };

  return (
    <div className={`select-control flex flex-col gap-1 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-700">
          {label}
        </label>
      )}

      <div className="relative inline-flex items-center w-full">
        <select
          disabled={disabled}
          className={`appearance-none w-full border border-slate-300 rounded-none bg-white text-slate-800 outline-none focus:border-blue-600 cursor-pointer transition-colors shadow-none box-border disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
            error ? 'border-red-500 focus:border-red-600' : ''
          } ${heightClasses[size] ?? heightClasses.md} ${className}`}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>

        <ChevronDown
          size={14}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>

      {error && <span className="text-[11px] text-red-600 font-medium">{error}</span>}
    </div>
  );
};
