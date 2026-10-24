import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useToast } from './useToast.js';
import type { ToastItem } from './ToastTypes.js';

export const ToastItemView: React.FC<{ toast: ToastItem; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={20} className="toast-icon text-success" />;
      case 'warning':
        return <AlertTriangle size={20} className="toast-icon text-warning" />;
      case 'error':
        return <AlertCircle size={20} className="toast-icon text-danger" />;
      case 'info':
      default:
        return <Info size={20} className="toast-icon text-info" />;
    }
  };

  return (
    <div className={`crm-toast-item toast-${toast.type}`} role="alert">
      <div className="toast-main">
        <div className="toast-icon-wrapper">{getIcon()}</div>
        <div className="toast-content">
          {toast.title && <div className="toast-title">{toast.title}</div>}
          <div className="toast-message">{toast.message}</div>

          {/* Vị trí phát sinh lỗi */}
          {toast.location && (
            <div className="toast-location-tag">
              <MapPin size={12} />
              <span>Nơi phát sinh: <code>{toast.location}</code></span>
            </div>
          )}

          {/* Chi tiết kỹ thuật / Stack Trace có thể gập mở */}
          {toast.details !== undefined && toast.details !== null && (
            <div className="toast-details-container">
              <button
                type="button"
                className="toast-details-toggle"
                onClick={() => setShowDetails(!showDetails)}
              >
                <span>{showDetails ? 'Ẩn chi tiết kỹ thuật' : 'Xem chi tiết kỹ thuật lỗi'}</span>
                {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {showDetails && (
                <pre className="toast-details-box">
                  {typeof toast.details === 'string'
                    ? toast.details
                    : JSON.stringify(toast.details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="toast-close-btn"
          onClick={() => onDismiss(toast.id)}
          aria-label="Đóng thông báo"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="crm-toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItemView key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
};
