import React, { useState, useEffect } from 'react';

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  badge?: React.ReactNode;
}

const AVATAR_COLORS = [
  '#0284c7', // Sky blue
  '#0d9488', // Teal
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#d97706', // Amber
  '#e11d48', // Rose
  '#16a34a', // Green
];

function getInitials(name: string): string {
  if (!name) return '?';
  const clean = name.trim().replace(/^khách hàng\s*/i, '');
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0];
  const last = parts[parts.length - 1][0];
  return `${first}${last}`.toUpperCase();
}

function getColor(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 44,
  className = '',
  badge,
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const initials = getInitials(name);
  const bgColor = getColor(name);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: `${size}px`,
    height: `${size}px`,
    flexShrink: 0,
    display: 'inline-block',
  };

  const isImageValid = src && !hasError && src.trim() !== '';

  return (
    <div style={containerStyle} className="avatar-root">
      {isImageValid ? (
        <img
          src={src}
          alt={name}
          className={className}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '9999px',
            objectFit: 'cover',
            display: 'block',
          }}
          onError={() => setHasError(true)}
        />
      ) : (
        <div
          className={className}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '9999px',
            backgroundColor: bgColor,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: `${Math.round(size * 0.38)}px`,
            userSelect: 'none',
            letterSpacing: '0.5px',
          }}
          title={name}
        >
          {initials}
        </div>
      )}
      {badge}
    </div>
  );
};
