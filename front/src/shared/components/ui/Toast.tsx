import React from 'react';
import { CheckCircleIcon, AlertCircleIcon, CloseIcon } from '../icons/Icons';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '400px',
      }}
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const bg = isSuccess ? '#ECFDF5' : isError ? '#FEF2F2' : '#EFF6FF';
        const border = isSuccess ? '#A7F3D0' : isError ? '#FECACA' : '#BFDBFE';
        const textColor = isSuccess ? '#065F46' : isError ? '#991B1B' : '#1E40AF';

        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: bg,
              border: `1px solid ${border}`,
              color: textColor,
              boxShadow: 'var(--shadow-lg)',
              animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isSuccess ? (
                <CheckCircleIcon size={20} />
              ) : (
                <AlertCircleIcon size={20} />
              )}
              <span style={{ fontSize: '14px', fontWeight: 500 }}>{toast.message}</span>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              style={{
                color: textColor,
                opacity: 0.7,
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
              }}
            >
              <CloseIcon size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
