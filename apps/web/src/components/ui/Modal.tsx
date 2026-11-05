import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
  };

  const isFlat = variant === 'flat';

  const modalElement = (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
    >
      {/* Backdrop mờ che phủ toàn bộ viewport (bao gồm cả Header và Sidebar) */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200 ease-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => {
          if (closeOnOverlayClick && onClose) {
            onClose();
          }
        }}
      />

      {/* Hộp thoại Modal có max-height và scroll nội bộ */}
      <div
        className={`relative w-full ${sizeClasses[size] ?? sizeClasses.sm} max-h-[90vh] flex flex-col overflow-hidden shadow-2xl transform transition-all duration-200 ease-out ${
          isFlat
            ? 'rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl'
            : 'rounded-2xl border border-border-default/60 bg-bg-surface p-6 sm:p-7'
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
              <div className="flex items-start justify-between pb-3 border-b border-slate-200 mb-3 gap-3 shrink-0">
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

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 my-1">
              {children}
            </div>

            {/* Footer hành động nếu có primary/secondary action */}
            {(primaryAction || secondaryAction) && (
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-3 shrink-0">
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
                className="absolute top-4 right-4 rounded-lg p-1.5 text-text-secondary hover:bg-bg-page hover:text-text-primary transition-colors cursor-pointer z-10"
                onClick={onClose}
                type="button"
              >
                <X className="size-5" />
              </button>
            )}

            {/* Khối Icon */}
            {icon && (
              <div className="mb-4 flex items-center justify-start shrink-0">
                {icon}
              </div>
            )}

            {/* Tiêu đề & Mô tả */}
            {(title || description) && (
              <div className="text-left space-y-1 mb-4 shrink-0 pr-8">
                {title && (
                  <h2 className="font-sans text-base sm:text-lg font-bold tracking-tight text-slate-900 m-0">
                    {title}
                  </h2>
                )}
                {description && (
                  <div className="font-sans text-xs sm:text-sm text-slate-500 leading-relaxed m-0">
                    {description}
                  </div>
                )}
              </div>
            )}

            {/* Vùng nội dung có thanh cuộn mượt khi dài */}
            {children && (
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 mb-2">
                {children}
              </div>
            )}

            {/* Nút hành động */}
            {(primaryAction || secondaryAction) && (
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100 mt-2 shrink-0">
                {secondaryAction && (
                  <Button
                    disabled={secondaryAction.disabled}
                    onClick={secondaryAction.onClick}
                    type="button"
                    variant={secondaryAction.variant || 'secondary'}
                    size="sm"
                    className="px-4 py-2 text-xs"
                  >
                    {secondaryAction.label}
                  </Button>
                )}
                {primaryAction && (
                  <Button
                    disabled={primaryAction.disabled}
                    loading={primaryAction.loading}
                    onClick={primaryAction.onClick}
                    type="button"
                    variant={primaryAction.variant || 'primary'}
                    size="sm"
                    className="px-5 py-2 text-xs"
                  >
                    {primaryAction.label}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalElement, document.body)
    : modalElement;
}
