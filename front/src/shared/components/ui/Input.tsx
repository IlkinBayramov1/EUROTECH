import React, { useState } from 'react';
import { EyeIcon, EyeOffIcon } from '../icons/Icons';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  type = 'text',
  style,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        {leftIcon && (
          <div style={{ position: 'absolute', left: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
            {leftIcon}
          </div>
        )}
        <input
          type={effectiveType}
          style={{
            width: '100%',
            padding: leftIcon ? '10px 14px 10px 38px' : isPassword ? '10px 38px 10px 14px' : '10px 14px',
            fontSize: '14px',
            color: 'var(--color-text-primary)',
            backgroundColor: 'var(--color-surface)',
            border: error ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            outline: 'none',
            transition: 'border-color var(--transition-fast)',
            ...style,
          }}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '12px',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              padding: '2px',
            }}
          >
            {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
          </button>
        )}
      </div>
      {error && <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{error}</span>}
      {helperText && !error && <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{helperText}</span>}
    </div>
  );
};
