import type { InputHTMLAttributes, ReactNode } from "react";

type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  children: ReactNode;
};

export function Checkbox({
  children,
  className = "",
  ...props
}: CheckboxProps) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 font-sans text-body text-text-primary ${className}`.trim()}>
      <input
        {...props}
        type="checkbox"
        className="size-5 cursor-pointer accent-brand-primary"
      />
      <span>{children}</span>
    </label>
  );
}
