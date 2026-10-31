import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button, type ButtonProps } from './Button.js';

export type ModalAction = {
  label: string;
  onClick: () => void;
  variant?: ButtonProps['variant'];
  loading?: boolean;
  disabled?: boolean;
};

export type ModalProps = {
  isOpen: boolean;
  onClose?: () => void;
  onExited?: () => void;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  primaryAction?: ModalAction;
  secondaryAction?: ModalAction;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  className?: string;
  variant?: 'rounded' | 'flat';
};

export function Modal({
  isOpen,
  onClose,
  onExited,
  title,
  description,
  icon,
  children,
  primaryAction,
  secondaryAction,
  size = 'sm',
  showCloseButton = false,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  className = '',
  variant = 'rounded',
}: ModalProps) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      // Hai frame liên tiếp để đảm bảo DOM đã render trạng thái khởi tạo
      const rafId = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
      return () => cancelAnimationFrame(rafId);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
        onExited?.();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onExited]);

  useEffect(() => {
    if (!isOpen || !closeOnEsc || !onClose) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEsc, onClose]);

  // Khóa scroll khi mở modal và trong suốt animation
  useEffect(() => {
    if (isRendered) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isRendered]);

  if (!isRendered) return null;

  const sizeClasses: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-xl',
    xl: 'max-w-2xl',
  };

  const isFlat = variant === 'flat';

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
    >
      {/* Backdrop mờ dần */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200 ease-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => {
          if (closeOnOverlayClick && onClose) {
            onClose();
          }
        }}
      />

      {/* Hộp thoại Modal */}
      <div
        className={`relative w-full ${sizeClasses[size] ?? sizeClasses.sm} overflow-hidden shadow-xl transform transition-all duration-200 ease-out ${
          isFlat
            ? 'rounded-none border border-slate-300 bg-white p-5'
            : 'rounded-3xl border border-border-default/60 bg-bg-surface p-7 sm:p-8'
        } ${
          isAnimating
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-[0.96] pointer-events-none'
        } ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {isFlat ? (
          <>
            {/* Header phẳng (Flat header) */}
            {(title || description || (showCloseButton && onClose)) && (
              <div className="flex items-start justify-between pb-3 border-b border-slate-200 mb-4 gap-3">
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  {title && (
                    <div className="text-sm font-bold text-slate-900 m-0">
                      {title}
                    </div>
                  )}
                  {description && (
                    <div className="text-xs text-slate-500 m-0">
                      {description}
                    </div>
                  )}
                </div>
                {showCloseButton && onClose && (
                  <button
                    aria-label="Đóng popup"
                    className="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-0 shrink-0"
                    onClick={onClose}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}

            {children}

            {/* Footer hành động nếu có primary/secondary action */}
            {(primaryAction || secondaryAction) && (
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                {secondaryAction && (
                  <button
                    type="button"
                    disabled={secondaryAction.disabled}
                    onClick={secondaryAction.onClick}
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-none cursor-pointer hover:bg-slate-50"
                  >
                    {secondaryAction.label}
                  </button>
                )}
                {primaryAction && (
                  <button
                    type="button"
                    disabled={primaryAction.disabled || primaryAction.loading}
                    onClick={primaryAction.onClick}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-none border-none cursor-pointer disabled:opacity-50"
                  >
                    {primaryAction.loading ? 'Đang xử lý...' : primaryAction.label}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {showCloseButton && onClose && (
              <button
                aria-label="Đóng popup"
                className="absolute top-5 right-5 rounded-lg p-1.5 text-text-secondary hover:bg-bg-page hover:text-text-primary transition-colors"
                onClick={onClose}
                type="button"
              >
                <X className="size-5" />
              </button>
            )}

            {/* Khối Icon */}
            {icon && (
              <div className="mb-6 flex items-center justify-start shrink-0">
                {icon}
              </div>
            )}

            {/* Tiêu đề & Mô tả */}
            {(title || description) && (
              <div className="text-left space-y-2.5 mb-6">
                {title && (
                  <h2 className="font-sans text-2xl font-bold tracking-tight text-text-primary">
                    {title}
                  </h2>
                )}
                {description && (
                  <div className="font-sans text-base text-text-secondary leading-relaxed">
                    {description}
                  </div>
                )}
              </div>
            )}

            {children && <div className="mb-6">{children}</div>}

            {/* Nút hành động */}
            {(primaryAction || secondaryAction) && (
              <div className="flex flex-wrap items-center justify-start gap-3 mt-7">
                {primaryAction && (
                  <Button
                    disabled={primaryAction.disabled}
                    loading={primaryAction.loading}
                    onClick={primaryAction.onClick}
                    type="button"
                    variant={primaryAction.variant || 'primary'}
                    className="px-6 py-2.5 rounded-xl font-medium"
                  >
                    {primaryAction.label}
                  </Button>
                )}
                {secondaryAction && (
                  <Button
                    disabled={secondaryAction.disabled}
                    onClick={secondaryAction.onClick}
                    type="button"
                    variant={secondaryAction.variant || 'secondary'}
                    className="px-6 py-2.5 rounded-xl font-medium"
                  >
                    {secondaryAction.label}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}