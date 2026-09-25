'use client';

import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { ButtonVariant, ButtonSize } from './Button';

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  'aria-label': string;
  icon: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isRound?: boolean;
}

const sizeMap: Record<ButtonSize, string> = {
  xs: 'w-6 h-6 p-1 text-[12px]',
  sm: 'w-8 h-8 p-1.5 text-[14px]',
  md: 'w-9 h-9 p-2 text-[16px]',
  lg: 'w-10 h-10 p-2.5 text-[18px]',
};

const variantMap: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)] border border-transparent shadow-xs',
  secondary:
    'bg-[var(--bg-surface-hover)] text-[var(--text-primary)] hover:bg-[var(--border-default)] border border-[var(--border-default)] shadow-xs',
  outline:
    'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-default)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent',
  danger:
    'bg-transparent text-[var(--semantic-danger-icon)] hover:bg-[var(--semantic-danger-bg)] border border-transparent',
  success:
    'bg-transparent text-[var(--semantic-success-icon)] hover:bg-[var(--semantic-success-bg)] border border-transparent',
  link: 'bg-transparent text-[var(--brand-primary)] hover:underline border-none',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      variant = 'ghost',
      size = 'md',
      isLoading = false,
      isRound = false,
      disabled,
      className = '',
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
          inline-flex items-center justify-center shrink-0 transition-colors select-none cursor-pointer
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
          ${variantMap[variant]}
          ${sizeMap[size]}
          ${isRound ? 'rounded-full' : 'rounded-[var(--radius-button)]'}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" aria-hidden="true" />
        ) : (
          icon
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
