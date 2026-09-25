'use client';

import React, { forwardRef } from 'react';
import { Loader2, X } from 'lucide-react';
import { useFormField } from './FormField';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  error?: boolean | string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
  onClear?: () => void;
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'text-[12px] h-8 px-2.5',
  md: 'text-[13px] h-9 px-3',
  lg: 'text-[14px] h-10 px-3.5',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'md',
      error: propError,
      leftIcon,
      rightIcon,
      isLoading = false,
      onClear,
      disabled: propDisabled,
      required: propRequired,
      id: propId,
      className = '',
      type = 'text',
      value,
      ...props
    },
    ref
  ) => {
    const formField = useFormField();

    const id = propId || formField?.id;
    const hasError = !!propError || !!formField?.error;
    const isDisabled = propDisabled !== undefined ? propDisabled : formField?.disabled;
    const isRequired = propRequired !== undefined ? propRequired : formField?.required;
    const isFieldLoading = isLoading || formField?.isLoading;

    const describedBy = [
      hasError && formField?.errorId,
      formField?.helpText && formField?.helpTextId,
      props['aria-describedby'],
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-2.5 flex items-center pointer-events-none text-[var(--text-muted)]">
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={id}
          type={type}
          value={value}
          disabled={isDisabled}
          required={isRequired}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          className={`
            w-full bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder-[var(--text-muted)]
            rounded-[var(--radius-input)] border transition-colors outline-none
            focus-visible:ring-2 focus-visible:ring-offset-1
            ${sizeClasses[size]}
            ${leftIcon ? 'pl-8' : ''}
            ${rightIcon || isFieldLoading || onClear ? 'pr-8' : ''}
            ${
              hasError
                ? 'border-[var(--semantic-danger-icon)] focus-visible:border-[var(--semantic-danger-icon)] focus-visible:ring-[var(--semantic-danger-icon)]/20'
                : 'border-[var(--border-default)] hover:border-[var(--border-strong)] focus-visible:border-[var(--border-focus)] focus-visible:ring-[var(--border-focus)]/20'
            }
            disabled:bg-[var(--bg-surface-hover)] disabled:text-[var(--text-disabled)] disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />

        <div className="absolute right-2.5 flex items-center gap-1.5 text-[var(--text-muted)]">
          {isFieldLoading && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--brand-primary)]" aria-hidden="true" />
          )}
          {!isFieldLoading && onClear && value && !isDisabled && (
            <button
              type="button"
              onClick={onClear}
              className="p-0.5 hover:text-[var(--text-primary)] rounded-full focus:outline-none"
              aria-label="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {!isFieldLoading && rightIcon}
        </div>
      </div>
    );
  }
);

Input.displayName = 'Input';
