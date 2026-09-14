import React from 'react';
import { CheckCircleIcon } from '../icons/Icons';

export interface StepperProps {
  steps: string[];
  currentStep: number; // 1-indexed
  onStepClick?: (step: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '16px 0',
      }}
    >
      {steps.map((stepName, idx) => {
        const stepNum = idx + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;

        return (
          <React.Fragment key={stepName}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: onStepClick && isCompleted ? 'pointer' : 'default',
              }}
              onClick={() => onStepClick && isCompleted && onStepClick(stepNum)}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 700,
                  backgroundColor: isCompleted
                    ? 'var(--color-tertiary)'
                    : isCurrent
                    ? 'var(--color-secondary)'
                    : '#E2E8F0',
                  color: isCompleted || isCurrent ? '#FFFFFF' : 'var(--color-text-muted)',
                  transition: 'all var(--transition-normal)',
                  flexShrink: 0,
                }}
              >
                {isCompleted ? <CheckCircleIcon size={18} /> : stepNum}
              </div>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent
                    ? 'var(--color-primary)'
                    : isCompleted
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {stepName}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  backgroundColor: isCompleted ? 'var(--color-tertiary)' : '#E2E8F0',
                  margin: '0 12px',
                  transition: 'all var(--transition-normal)',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
