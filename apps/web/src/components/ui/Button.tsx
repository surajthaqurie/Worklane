'use client';

import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'link';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)] active:opacity-90 border border-transparent shadow-xs',
  secondary:
    'bg-[var(--bg-surface-hover)] text-[var(--text-primary)] hover:bg-[var(--border-default)] border border-[var(--border-default)] shadow-xs',
  outline:
    'bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-default)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent',
  danger:
    'bg-[var(--semantic-danger-icon)] text-white hover:opacity-90 active:opacity-80 border border-transparent shadow-xs',
  success:
    'bg-[var(--semantic-success-icon)] text-white hover:opacity-90 active:opacity-80 border border-transparent shadow-xs',
  link:
    'bg-transparent text-[var(--brand-primary)] hover:underline p-0 h-auto border-none inline-flex items-center',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'text-[11px] px-2 py-1 h-6 gap-1 rounded-[var(--radius-xs)] font-medium',
  sm: 'text-[12px] px-2.5 py-1.5 h-8 gap-1.5 rounded-[var(--radius-button)] font-medium',
  md: 'text-[13px] px-3.5 py-2 h-9 gap-2 rounded-[var(--radius-button)] font-medium',
  lg: 'text-[14px] px-4.5 py-2.5 h-10 gap-2.5 rounded-[var(--radius-md)] font-semibold',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isInteractiveDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isInteractiveDisabled}
        aria-busy={isLoading}
        aria-disabled={isInteractiveDisabled}
        className={`
          inline-flex items-center justify-center transition-colors select-none cursor-pointer
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {isLoading && (
          <Loader2
            className="w-3.5 h-3.5 animate-spin shrink-0 text-current"
            aria-hidden="true"
          />
        )}
        {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
