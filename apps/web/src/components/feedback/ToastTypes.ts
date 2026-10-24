import type { ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: ReactNode;
  duration?: number;
  location?: string;
  details?: unknown;
  timestamp: Date;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
  location?: string;
  details?: unknown;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  show: (type: ToastType, message: ReactNode, options?: ToastOptions) => string;
  success: (message: ReactNode, title?: string, options?: ToastOptions) => string;
  error: (message: ReactNode, title?: string, options?: ToastOptions) => string;
  warning: (message: ReactNode, title?: string, options?: ToastOptions) => string;
  info: (message: ReactNode, title?: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  clearAll: () => void;
}
