import React from 'react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'success':
        return <CheckCircle2 size={18} className="text-success" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-warning" />;
      case 'danger':
        return <AlertCircle size={18} className="text-danger" />;
      case 'info':
      default:
        return <Info size={18} className="text-info" />;
    }
  };

  return (
    <div className={`alert alert-${variant} ${className}`.trim()} role="alert">
      <div className="alert-icon">{getIcon()}</div>
      <div className="alert-content">
        {title && <div className="alert-title">{title}</div>}
        <div className="alert-message">{children}</div>
      </div>
      {onClose && (
        <button type="button" className="alert-close-btn" onClick={onClose} aria-label="Đóng">
          <X size={16} />
        </button>
      )}
    </div>
  );
};
