import type { InputHTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";

type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  children?: ReactNode;
};

export function Checkbox({
  children,
  className = "",
  disabled,
  ...props
}: CheckboxProps) {
  return (
    <label
      className={`inline-flex items-center gap-2 select-none font-sans text-body text-text-primary ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${className}`.trim()}
    >
      <div className="relative flex size-4.5 shrink-0 items-center justify-center">
        <input
          {...props}
          disabled={disabled}
          type="checkbox"
          className="peer sr-only"
        />
        <div className="size-4.5 rounded-[4px] border border-border-default bg-bg-surface transition-colors duration-150 peer-checked:border-brand-primary peer-checked:bg-brand-primary peer-focus-visible:ring-2 peer-focus-visible:ring-brand-primary/30 peer-hover:border-brand-primary" />
        <Check
          className="pointer-events-none absolute size-3.25 text-white opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
          strokeWidth={2}
        />
      </div>
      {children && <span>{children}</span>}
    </label>
  );
}
