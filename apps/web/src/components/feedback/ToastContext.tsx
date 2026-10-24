import React, { useState, useCallback, useEffect } from 'react';
import type { ToastItem, ToastOptions, ToastType } from './ToastTypes.js';
import { ToastContext } from './useToast.js';
import { registerToastEmitter } from './toastEmitter.js';

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const show = useCallback(
    (type: ToastType, message: React.ReactNode, options: ToastOptions = {}) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const duration = options.duration !== undefined ? options.duration : type === 'error' ? 6000 : 4000;

      const newToast: ToastItem = {
        id,
        type,
        title: options.title,
        message,
        duration,
        location: options.location,
        details: options.details,
        timestamp: new Date(),
      };

      setToasts((prev) => [newToast, ...prev].slice(0, 5)); // Tối đa 5 toast cùng lúc

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }

      return id;
    },
    [dismiss],
  );

  const success = useCallback(
    (msg: React.ReactNode, title?: string, opts?: ToastOptions) =>
      show('success', msg, { title, ...opts }),
    [show],
  );

  const error = useCallback(
    (msg: React.ReactNode, title?: string, opts?: ToastOptions) =>
      show('error', msg, { title: title || 'Lỗi xử lý', ...opts }),
    [show],
  );

  const warning = useCallback(
    (msg: React.ReactNode, title?: string, opts?: ToastOptions) =>
      show('warning', msg, { title, ...opts }),
    [show],
  );

  const info = useCallback(
    (msg: React.ReactNode, title?: string, opts?: ToastOptions) =>
      show('info', msg, { title, ...opts }),
    [show],
  );

  useEffect(() => {
    registerToastEmitter((type, message, options) => {
      show(type, message, options);
    });

    return () => {
      registerToastEmitter(null);
    };
  }, [show]);

  return (
    <ToastContext.Provider
      value={{ toasts, show, success, error, warning, info, dismiss, clearAll }}
    >
      {children}
    </ToastContext.Provider>
  );
};
