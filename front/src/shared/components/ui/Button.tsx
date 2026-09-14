import React from 'react';
import { Spinner } from './Spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  style,
  ...props
}) => {
  const getBaseStyles = (): React.CSSProperties => {
    let bg = 'var(--color-secondary)';
    let color = '#FFFFFF';
    let border = 'none';

    if (variant === 'primary') {
      bg = 'var(--color-primary)';
      color = '#FFFFFF';
    } else if (variant === 'secondary') {
      bg = 'var(--color-secondary)';
      color = '#FFFFFF';
    } else if (variant === 'outline') {
      bg = 'transparent';
      color = 'var(--color-primary)';
      border = '1px solid var(--color-border)';
    } else if (variant === 'danger') {
      bg = 'var(--color-danger)';
      color = '#FFFFFF';
    } else if (variant === 'ghost') {
      bg = 'transparent';
      color = 'var(--color-text-secondary)';
    }

    const padding = size === 'sm' ? '6px 12px' : size === 'lg' ? '12px 24px' : '9px 18px';
    const fontSize = size === 'sm' ? '13px' : size === 'lg' ? '16px' : '14px';

    return {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding,
      fontSize,
      fontWeight: 600,
      borderRadius: 'var(--radius-md)',
      backgroundColor: bg,
      color,
      border,
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled || isLoading ? 0.65 : 1,
      transition: 'all var(--transition-fast)',
      whiteSpace: 'nowrap',
      ...style,
    };
  };

  return (
    <button disabled={disabled || isLoading} style={getBaseStyles()} {...props}>
      {isLoading ? <Spinner /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};
