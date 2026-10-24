import React from 'react';

export interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  variant?: 'primary' | 'success' | 'danger' | 'neutral';
  description?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  variant = 'neutral',
  description,
}) => {
  return (
    <div className={`stat-card stat-card-${variant}`}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-body">
        <span className="stat-card-label">{label}</span>
        <span className="stat-card-value">{value}</span>
        {description && <span className="stat-card-desc">{description}</span>}
      </div>
    </div>
  );
};
