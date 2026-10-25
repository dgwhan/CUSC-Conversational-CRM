import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

export type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "prefix"
> & {
  label: string;
  leadingIcon?: ReactNode;
  trailingAdornment?: ReactNode;
  errorMessage?: string;
  successMessage?: string;
};

export function TextField({
  errorMessage,
  successMessage,
  id,
  label,
  leadingIcon,
  trailingAdornment,
  className = "",
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  const describedBy =
    [
      inputProps["aria-describedby"],
      errorMessage ? errorId : undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <label
        className="font-sans text-label font-medium text-text-primary"
        htmlFor={inputId}
      >
        {label}
      </label>

      <div
        className={`flex min-h-[var(--control-height-lg)] min-w-0 items-center gap-2 rounded-control border px-4 transition-[border-color,box-shadow] focus-within:border-brand-primary focus-within:shadow-[0_0_0_3px_rgb(41_80_151_/_18%)] ${
          errorMessage ? "border-state-error" : "border-border-default"
        }`}
      >
        {leadingIcon && (
          <span className="inline-flex shrink-0 items-center text-text-secondary">
            {leadingIcon}
          </span>
        )}

        <input
          {...inputProps}
          id={inputId}
          className="h-[calc(var(--control-height-lg)-2px)] min-w-0 flex-1 border-0 bg-transparent px-0 font-sans text-body text-text-primary outline-none placeholder:text-text-muted focus-visible:outline-none"
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={describedBy}
        />

        {trailingAdornment && (
          <span className="inline-flex shrink-0 items-center text-text-secondary">
            {trailingAdornment}
          </span>
        )}
      </div>

      {errorMessage && (
        <p
          className="m-0 font-sans text-body text-state-error"
          id={errorId}
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      {!errorMessage && successMessage && (
        <p
          className="m-0 font-sans text-body text-state-success"
          id={`${inputId}-success`}
        >
          {successMessage}
        </p>
      )}
    </div>
  );
}
