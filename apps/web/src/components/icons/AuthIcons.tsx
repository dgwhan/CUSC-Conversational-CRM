import {
  Check,
  Circle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
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

export function UserIcon({ size = 20, ...props }: AuthIconProps) {
  return (
    <User
      size={size}
      strokeWidth={1.8}
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export function PhoneIcon({ size = 20, ...props }: AuthIconProps) {
  return (
    <Phone
      size={size}
      strokeWidth={1.8}
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export function CheckIcon({ size = 16, ...props }: AuthIconProps) {
  return (
    <Check
      size={size}
      strokeWidth={2.2}
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export function CircleIcon({ size = 16, ...props }: AuthIconProps) {
  return (
    <Circle
      size={size}
      strokeWidth={1.8}
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}
