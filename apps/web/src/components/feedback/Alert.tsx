'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { IconButton } from '../ui/IconButton';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  variant?: AlertVariant;
  title?: React.ReactNode;
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  action?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<
  AlertVariant,
  { container: string; text: string; icon: React.ReactNode }
> = {
  info: {
    container: 'bg-[var(--semantic-info-bg)] border-[var(--semantic-info-border)]',
    text: 'text-[var(--semantic-info-text)]',
    icon: <Info className="w-4 h-4 text-[var(--semantic-info-icon)]" />,
  },
  success: {
    container: 'bg-[var(--semantic-success-bg)] border-[var(--semantic-success-border)]',
    text: 'text-[var(--semantic-success-text)]',
    icon: <CheckCircle2 className="w-4 h-4 text-[var(--semantic-success-icon)]" />,
  },
  warning: {
    container: 'bg-[var(--semantic-warning-bg)] border-[var(--semantic-warning-border)]',
    text: 'text-[var(--semantic-warning-text)]',
    icon: <AlertTriangle className="w-4 h-4 text-[var(--semantic-warning-icon)]" />,
  },
  error: {
    container: 'bg-[var(--semantic-danger-bg)] border-[var(--semantic-danger-border)]',
    text: 'text-[var(--semantic-danger-text)]',
    icon: <AlertCircle className="w-4 h-4 text-[var(--semantic-danger-icon)]" />,
  },
};

export function Alert({
  variant = 'info',
  title,
  children,
  icon,
  onClose,
  action,
  className = '',
}: AlertProps) {
  const config = variantStyles[variant];

  return (
    <div
      role="alert"
      className={`
        flex items-start gap-3 p-3.5 border rounded-[var(--radius-card)] transition-colors
        ${config.container}
        ${className}
      `}
    >
      <div className="shrink-0 mt-0.5" aria-hidden="true">
        {icon || config.icon}
      </div>

      <div className="flex-1 min-w-0">
        {title && (
          <h4 className={`text-[13px] font-semibold mb-0.5 leading-snug ${config.text}`}>
            {title}
          </h4>
        )}
        <div className={`text-[12px] leading-relaxed ${config.text}`}>
          {children}
        </div>
        {action && <div className="mt-2.5">{action}</div>}
      </div>

      {onClose && (
        <IconButton
          icon={<X className="w-3.5 h-3.5" />}
          aria-label="Dismiss alert"
          size="xs"
          variant="ghost"
          onClick={onClose}
        />
      )}
    </div>
  );
}
