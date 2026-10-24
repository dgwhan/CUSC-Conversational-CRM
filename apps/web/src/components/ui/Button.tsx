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
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex min-h-[var(--control-height-lg)] items-center justify-center rounded-control px-5 py-3 font-sans text-button font-semibold transition-colors disabled:cursor-wait disabled:opacity-70";
  const variantClasses: Record<string, string> = {
    primary:
      "border border-transparent bg-brand-primary text-bg-surface hover:bg-brand-primary-hover",
    secondary:
      "border border-border-default bg-bg-surface text-text-primary hover:bg-bg-page",
    outline:
      "border border-border-default bg-transparent text-text-primary hover:bg-bg-page",
    danger:
      "border border-transparent bg-red-600 text-white hover:bg-red-700",
    ghost:
      "border border-transparent bg-transparent text-text-primary hover:bg-bg-page",
  };
  const sizeClasses: Record<string, string> = {
    sm: "text-sm px-3 py-1.5 min-h-0",
    md: "",
    lg: "text-lg px-6 py-4",
  };
  const classes =
    `${baseClasses} ${variantClasses[variant] ?? variantClasses.primary} ${sizeClasses[size] ?? ""} ${fullWidth ? "w-full" : ""} ${className}`.trim();

  return (
    <button className={classes} type={type} disabled={disabled || loading} {...props}>
      {loading && <Loader2 size={16} className="animate-spin mr-2" />}
      {!loading && icon && iconPosition === "left" && <span className="mr-2">{icon}</span>}
      {children}
      {!loading && icon && iconPosition === "right" && <span className="ml-2">{icon}</span>}
    </button>
  );
}
