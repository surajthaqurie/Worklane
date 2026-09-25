'use client';

import React from 'react';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  dotColor?: string;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
  secondary:
    'bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] border-[var(--border-default)]',
  brand:
    'bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)] border-[var(--brand-primary)]/20',
  success:
    'bg-[var(--semantic-success-bg)] text-[var(--semantic-success-text)] border-[var(--semantic-success-border)]',
  warning:
    'bg-[var(--semantic-warning-bg)] text-[var(--semantic-warning-text)] border-[var(--semantic-warning-border)]',
  danger:
    'bg-[var(--semantic-danger-bg)] text-[var(--semantic-danger-text)] border-[var(--semantic-danger-border)]',
  info:
    'bg-[var(--semantic-info-bg)] text-[var(--semantic-info-text)] border-[var(--semantic-info-border)]',
  outline:
    'bg-transparent text-[var(--text-secondary)] border-[var(--border-default)]',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-[var(--text-muted)]',
  secondary: 'bg-[var(--text-secondary)]',
  brand: 'bg-[var(--brand-primary)]',
  success: 'bg-[var(--semantic-success-icon)]',
  warning: 'bg-[var(--semantic-warning-icon)]',
  danger: 'bg-[var(--semantic-danger-icon)]',
  info: 'bg-[var(--semantic-info-icon)]',
  outline: 'bg-[var(--text-muted)]',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[11px] px-1.5 py-0.5 gap-1',
  md: 'text-[12px] px-2 py-0.5 gap-1.5',
};

export function Badge({
  variant = 'default',
  size = 'sm',
  dot = false,
  dotColor,
  icon,
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-[var(--radius-xs)] border
        select-none whitespace-nowrap
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor || dotColors[variant]}`}
          aria-hidden="true"
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
