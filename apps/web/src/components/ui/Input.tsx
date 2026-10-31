import React, { type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  error?: ReactNode;
  helperText?: ReactNode;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

/**
 * Standard Global Flat Input Component
 */
export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leadingIcon,
  trailingIcon,
  size = 'md',
  fullWidth = true,
  className = '',
  disabled,
  ...props
}) => {
  const heightClasses: Record<string, string> = {
    sm: 'py-1 text-[12px] h-[30px]',
    md: 'py-1.5 text-xs h-[36px]',
    lg: 'py-2 text-sm h-[42px]',
  };

  const paddingLeft = leadingIcon ? 'pl-8' : 'pl-3';
  const paddingRight = trailingIcon ? 'pr-8' : 'pr-3';

  return (
    <div className={`input-control flex flex-col gap-1 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-700">
          {label}
        </label>
      )}

      <div className="relative inline-flex items-center w-full">
        {leadingIcon && (
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none shrink-0 flex items-center justify-center">
            {leadingIcon}
          </div>
        )}

        <input
          disabled={disabled}
          className={`w-full border border-slate-300 rounded-none bg-white text-slate-900 outline-none focus:border-blue-600 transition-colors shadow-none box-border placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${paddingLeft} ${paddingRight} ${
            error ? 'border-red-500 focus:border-red-600' : ''
          } ${heightClasses[size] ?? heightClasses.md} ${className}`}
          {...props}
        />

        {trailingIcon && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none shrink-0 flex items-center justify-center">
            {trailingIcon}
          </div>
        )}
      </div>

      {error && <span className="text-[11px] text-red-600 font-medium">{error}</span>}
      {!error && helperText && <span className="text-[11px] text-slate-500">{helperText}</span>}
    </div>
  );
};
