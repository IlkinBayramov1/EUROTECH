import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: string;
  isActive?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  isActive = false,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '20px',
        backgroundColor: 'var(--color-surface)',
        border: isActive ? '1px solid var(--color-secondary)' : '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: isActive ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transition: 'all var(--transition-normal)',
      }}
    >
      {icon && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: isActive ? 'var(--color-secondary-light)' : '#F1F5F9',
            color: isActive ? 'var(--color-secondary)' : 'var(--color-primary)',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
          {title}
        </span>
        <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '2px' }}>
          {value}
        </span>
        {subtitle && (
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
