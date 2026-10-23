import { useState } from "react";
import {
  EyeIcon,
  EyeOffIcon,
  LockIcon,
} from "../icons/AuthIcons.js";
import { TextField } from "./TextField.js";

type PasswordFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  errorMessage?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function PasswordField({
  id,
  value,
  onChange,
  errorMessage,
  placeholder = "Nhập mật khẩu",
  disabled,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      id={id}
      label="Mật khẩu"
      name="password"
      type={visible ? "text" : "password"}
      autoComplete="current-password"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      leadingIcon={<LockIcon />}
      trailingAdornment={
        <button
          className="grid size-8 place-items-center rounded-sm text-text-secondary hover:bg-bg-page disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
      errorMessage={errorMessage}
      disabled={disabled}
      required
    />
  );
}
