'use client';

import React, { forwardRef } from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { useFormField } from './FormField';
import { InputSize } from './Input';

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange'> {
  size?: InputSize;
  error?: boolean | string;
  value?: string;
  onChange?: (dateString: string) => void;
  showPresets?: boolean;
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'text-[12px] h-8 pl-8 pr-7',
  md: 'text-[13px] h-9 pl-9 pr-8',
  lg: 'text-[14px] h-10 pl-10 pr-9',
};

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      size = 'md',
      error: propError,
      value = '',
      onChange,
      showPresets = false,
      disabled: propDisabled,
      required: propRequired,
      id: propId,
      className = '',
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

    const setPreset = (offsetDays: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      const iso = d.toISOString().slice(0, 10);
      onChange?.(iso);
    };

    return (
      <div className="flex flex-col gap-1.5 w-full">
        <div className="relative flex items-center w-full">
          <div className="absolute left-2.5 flex items-center pointer-events-none text-[var(--text-muted)]">
            <CalendarIcon className="w-4 h-4" aria-hidden="true" />
          </div>

          <input
            ref={ref}
            id={id}
            type="date"
            value={value}
            disabled={isDisabled}
            required={isRequired}
            aria-invalid={hasError}
            aria-describedby={describedBy}
            onChange={(e) => onChange?.(e.target.value)}
            className={`
              w-full bg-[var(--bg-surface)] text-[var(--text-primary)]
              rounded-[var(--radius-input)] border transition-colors outline-none
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
          />

          {value && !isDisabled && (
            <button
              type="button"
              onClick={() => onChange?.('')}
              className="absolute right-2.5 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-full focus:outline-none"
              aria-label="Clear date"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {showPresets && !isDisabled && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setPreset(0)}
              className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface-hover)] hover:bg-[var(--border-default)] text-[var(--text-secondary)] font-medium transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPreset(1)}
              className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface-hover)] hover:bg-[var(--border-default)] text-[var(--text-secondary)] font-medium transition-colors"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => setPreset(7)}
              className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface-hover)] hover:bg-[var(--border-default)] text-[var(--text-secondary)] font-medium transition-colors"
            >
              +1 Week
            </button>
          </div>
        )}
      </div>
    );
  }
);

DatePicker.displayName = 'DatePicker';
