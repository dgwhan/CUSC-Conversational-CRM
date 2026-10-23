import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
};

export function Button({
  children,
  className = "",
  fullWidth = false,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex min-h-[var(--control-height-lg)] items-center justify-center rounded-control px-5 py-3 font-sans text-button font-semibold transition-colors disabled:cursor-wait disabled:opacity-70";
  const variantClasses = {
    primary:
      "border border-transparent bg-brand-primary text-bg-surface hover:bg-brand-primary-hover",
    secondary:
      "border border-border-default bg-bg-surface text-text-primary hover:bg-bg-page",
  };
  const classes = `${baseClasses} ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`.trim();

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  );
}
