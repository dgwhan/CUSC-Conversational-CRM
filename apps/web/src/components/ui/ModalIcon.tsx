import type { ReactNode } from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

export type ModalIconVariant = 'success' | 'danger' | 'warning' | 'info';

export type ModalIconProps = {
  variant?: ModalIconVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  className?: string;
};

/**
 * ModalIcon - Component icon dùng chung cho các popup/modal thông báo.

 */
export function ModalIcon({
  variant = 'success',
  size = 'md',
  icon,
  className = '',
}: ModalIconProps) {
  const sizeMap = {
    sm: {
      outer: 'w-11 h-11',
      inner: 'w-7 h-7',
      iconSize: 14,
    },
    md: {
      outer: 'w-14 h-14',
      inner: 'w-8 h-8',
      iconSize: 18,
    },
    lg: {
      outer: 'w-16 h-16',
      inner: 'w-10 h-10',
      iconSize: 22,
    },
  };

  const currentSize = sizeMap[size] ?? sizeMap.md;

  const variantConfig = {
    success: {
      outerBg: 'bg-[#24498a]/10',
      innerBg: 'bg-[#24498a]',
      defaultIcon: <Check size={currentSize.iconSize} strokeWidth={3} className="text-white" />,
    },
    danger: {
      outerBg: 'bg-red-500/10',
      innerBg: 'bg-red-600',
      defaultIcon: <X size={currentSize.iconSize} strokeWidth={3} className="text-white" />,
    },
    warning: {
      outerBg: 'bg-amber-500/10',
      innerBg: 'bg-amber-500',
      defaultIcon: <AlertTriangle size={currentSize.iconSize} strokeWidth={2.5} className="text-white" />,
    },
    info: {
      outerBg: 'bg-sky-500/10',
      innerBg: 'bg-sky-600',
      defaultIcon: <Info size={currentSize.iconSize} strokeWidth={2.5} className="text-white" />,
    },
  };

  const currentVariant = variantConfig[variant] ?? variantConfig.success;

  return (
    <div
      aria-hidden="true"
      className={`inline-flex ${currentSize.outer} shrink-0 aspect-square items-center justify-center rounded-full ${currentVariant.outerBg} ${className}`}
    >
      <div
        className={`flex ${currentSize.inner} shrink-0 aspect-square items-center justify-center rounded-full ${currentVariant.innerBg} text-white shadow-xs`}
      >
        {icon ?? currentVariant.defaultIcon}
      </div>
    </div>
  );
}

// Alias để tiện gọi nhanh cho các popup thành công
export function SuccessModalIcon(props: Omit<ModalIconProps, 'variant'>) {
  return <ModalIcon variant="success" {...props} />;
}
