import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = '24px',
  style,
  ...props
}) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
