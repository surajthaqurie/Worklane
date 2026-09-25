'use client';

import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useFormField } from './FormField';
import { InputSize } from './Input';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: InputSize;
  error?: boolean | string;
  options?: SelectOption[];
  placeholder?: string;
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'text-[12px] h-8 pl-2.5 pr-8',
  md: 'text-[13px] h-9 pl-3 pr-9',
  lg: 'text-[14px] h-10 pl-3.5 pr-10',
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      size = 'md',
      error: propError,
      options,
      placeholder,
      disabled: propDisabled,
      required: propRequired,
      id: propId,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const formField = useFormField();

    const id = propId || formField?.id;
    const hasError = !!propError || !!formField?.error;
    const isDisabled = propDisabled !== undefined ? propDisabled : formField?.disabled;
    const isRequired = propRequired !== undefined ? propRequired : formField?.required;

    const describedBy = [
      hasError && formField?.errorId,
      formField?.helpText && formField?.helpTextId,
      props['aria-describedby'],
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className="relative flex items-center w-full">
        <select
          ref={ref}
          id={id}
          disabled={isDisabled}
          required={isRequired}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          className={`
            w-full appearance-none bg-[var(--bg-surface)] text-[var(--text-primary)]
            rounded-[var(--radius-input)] border transition-colors outline-none cursor-pointer
            focus-visible:ring-2 focus-visible:ring-offset-1
            ${sizeClasses[size]}
            ${
              hasError
                ? 'border-[var(--semantic-danger-icon)] focus-visible:border-[var(--semantic-danger-icon)] focus-visible:ring-[var(--semantic-danger-icon)]/20'
                : 'border-[var(--border-default)] hover:border-[var(--border-strong)] focus-visible:border-[var(--border-focus)] focus-visible:ring-[var(--border-focus)]/20'
            }
            disabled:bg-[var(--bg-surface-hover)] disabled:text-[var(--text-disabled)] disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <div className="absolute right-2.5 pointer-events-none text-[var(--text-muted)] flex items-center">
          <ChevronDown className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>
    );
  }
);

Select.displayName = 'Select';
