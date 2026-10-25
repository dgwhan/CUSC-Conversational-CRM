import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from 'lucide-react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  loading?: boolean;
};

export function Button({
  children,
  className = "",
  fullWidth = false,
  type = "button",
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-sans font-semibold transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none whitespace-nowrap box-border";

  const variantClasses: Record<string, string> = {
    primary:
      "crm-btn crm-btn-primary crm-btn-gradient-primary text-white border border-sky-400/40 shadow-[0_2px_10px_rgba(14,165,233,0.35)] hover:shadow-[0_5px_18px_rgba(14,165,233,0.45)] hover:-translate-y-0.5 active:translate-y-0",
    secondary:
      "crm-btn crm-btn-secondary bg-white text-slate-700 border border-slate-300 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 hover:-translate-y-0.5 active:translate-y-0",
    outline:
      "border border-sky-200 bg-transparent text-sky-700 hover:bg-sky-50 hover:border-sky-300 hover:-translate-y-0.5 active:translate-y-0",
    danger:
      "border border-transparent bg-red-600 text-white hover:bg-red-700 shadow-sm hover:-translate-y-0.5 active:translate-y-0",
    ghost:
      "border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  };

  const sizeClasses: Record<string, string> = {
    sm: "h-[27px] text-[11.5px] px-2.5 py-1 rounded-[5px] gap-1.5",
    md: "h-[32px] text-[13px] px-3.5 py-1.5 rounded-md gap-2",
    lg: "h-[38px] text-[14px] px-5 py-2 rounded-md gap-2",
  };

  const classes =
    `${baseClasses} ${variantClasses[variant] ?? variantClasses.primary} ${sizeClasses[size] ?? sizeClasses.md} ${fullWidth ? "w-full" : ""} ${className}`.trim();

  const customStyle: React.CSSProperties = {
    ...(variant === 'primary' ? { background: 'var(--gradient-primary)' } : {}),
    ...style,
  };

  return (
    <button
      className={classes}
      type={type}
      disabled={disabled || loading}
      style={customStyle}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin mr-1.5" />}
      {!loading && icon && iconPosition === "left" && <span className="mr-1.5 flex items-center">{icon}</span>}
      {children}
      {!loading && icon && iconPosition === "right" && <span className="ml-1.5 flex items-center">{icon}</span>}
    </button>
  );
}
