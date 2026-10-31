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
  flat?: boolean;
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
  flat = true,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none box-border whitespace-nowrap shadow-none";

  const radiusClass = className.includes("rounded-") ? "" : flat ? "rounded-md" : "rounded-control";

  const variantClasses: Record<string, string> = {
    primary:
      "border border-transparent bg-blue-600 hover:bg-blue-700 text-white",
    secondary:
      "border border-slate-300 bg-white hover:bg-slate-50 text-slate-700",
    outline:
      "border border-blue-600 bg-transparent hover:bg-blue-50 text-blue-600",
    danger:
      "border border-transparent bg-red-600 hover:bg-red-700 text-white",
    ghost:
      "border border-transparent bg-transparent hover:bg-slate-100 text-slate-700",
  };

  const sizeClasses: Record<string, string> = {
    sm: "text-xs px-2.5 py-1 h-[30px] gap-1.5",
    md: "text-xs px-3.5 py-1.5 h-[36px] gap-1.5",
    lg: "text-sm px-4 py-2 h-[42px] gap-2",
  };

  const classes =
    `${baseClasses} ${radiusClass} ${variantClasses[variant] ?? variantClasses.primary} ${sizeClasses[size] ?? sizeClasses.md} ${fullWidth ? "w-full" : ""} ${className}`.trim();

  return (
    <button className={classes} type={type} disabled={disabled || loading} {...props}>
      {loading && <Loader2 size={size === 'sm' ? 12 : 14} className="animate-spin" />}
      {!loading && icon && iconPosition === "left" && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
      {!loading && icon && iconPosition === "right" && <span className="inline-flex shrink-0">{icon}</span>}
    </button>
  );
}
