import type { ReactNode } from 'react';
import type { ToastOptions, ToastType } from './ToastTypes.js';

type EmitterFn = (type: ToastType, message: ReactNode, options?: ToastOptions) => void;

let emitter: EmitterFn | null = null;

export function registerToastEmitter(fn: EmitterFn | null) {
  emitter = fn;
}

export const notify = {
  success: (msg: ReactNode, title?: string, opts?: ToastOptions) =>
    emitter?.('success', msg, { title, ...opts }),
  error: (msg: ReactNode, title?: string, opts?: ToastOptions) =>
    emitter?.('error', msg, { title: title || 'Lỗi hệ thống', ...opts }),
  warning: (msg: ReactNode, title?: string, opts?: ToastOptions) =>
    emitter?.('warning', msg, { title, ...opts }),
  info: (msg: ReactNode, title?: string, opts?: ToastOptions) =>
    emitter?.('info', msg, { title, ...opts }),
};
