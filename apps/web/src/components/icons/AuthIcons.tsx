import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  type LucideProps,
} from "lucide-react";

type AuthIconProps = Omit<LucideProps, "size"> & {
  size?: number;
};

export function MailIcon({ size = 20, ...props }: AuthIconProps) {
  return (
    <Mail
      size={size}
      strokeWidth={1.8}
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export function LockIcon({ size = 20, ...props }: AuthIconProps) {
  return (
    <Lock
      size={size}
      strokeWidth={1.8}
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export function EyeIcon({ size = 20, ...props }: AuthIconProps) {
  return (
    <Eye
      size={size}
      strokeWidth={1.8}
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export function EyeOffIcon({ size = 20, ...props }: AuthIconProps) {
  return (
    <EyeOff
      size={size}
      strokeWidth={1.8}
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export function ShieldCheckIcon({ size = 16, ...props }: AuthIconProps) {
  return (
    <ShieldCheck
      size={size}
      strokeWidth={1.8}
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}