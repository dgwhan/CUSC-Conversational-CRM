import React from 'react';

export interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'secondary',
  icon,
  children,
  className = '',
}) => {
  return (
    <span className={`badge badge-${variant} ${className}`.trim()}>
      {icon}
      {children}
    </span>
  );
};
