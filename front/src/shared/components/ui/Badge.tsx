import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
}) => {
  let bg = '#F1F5F9';
  let color = '#475569';
  let border = '1px solid #E2E8F0';

  if (variant === 'success') {
    bg = 'var(--color-tertiary-light)';
    color = 'var(--color-tertiary-hover)';
    border = '1px solid #A7F3D0';
  } else if (variant === 'warning') {
    bg = 'var(--color-accent-amber-light)';
    color = 'var(--color-accent-amber)';
    border = '1px solid #FDE68A';
  } else if (variant === 'danger') {
    bg = 'var(--color-danger-light)';
    color = 'var(--color-danger)';
    border = '1px solid #FECACA';
  } else if (variant === 'info') {
    bg = 'var(--color-secondary-light)';
    color = 'var(--color-secondary-hover)';
    border = '1px solid #BFDBFE';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        fontSize: size === 'sm' ? '11px' : '12px',
        fontWeight: 600,
        borderRadius: 'var(--radius-full)',
        backgroundColor: bg,
        color,
        border,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
};
