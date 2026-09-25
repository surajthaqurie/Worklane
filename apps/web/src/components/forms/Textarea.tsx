'use client';

import React, { forwardRef } from 'react';
import { useFormField } from './FormField';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean | string;
  showCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      error: propError,
      showCount = false,
      disabled: propDisabled,
      required: propRequired,
      id: propId,
      maxLength,
      className = '',
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

    const describedBy = [
      hasError && formField?.errorId,
      formField?.helpText && formField?.helpTextId,
      props['aria-describedby'],
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    const currentLength = typeof value === 'string' ? value.length : 0;

    return (
      <div className="relative flex flex-col w-full">
        <textarea
          ref={ref}
          id={id}
          value={value}
          maxLength={maxLength}
          disabled={isDisabled}
          required={isRequired}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          className={`
            w-full bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder-[var(--text-muted)]
            rounded-[var(--radius-input)] border p-2.5 text-[13px] transition-colors outline-none
            focus-visible:ring-2 focus-visible:ring-offset-1 resize-y leading-relaxed min-h-[80px]
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
        {showCount && maxLength && (
          <div className="flex justify-end mt-1 text-[11px] text-[var(--text-muted)] select-none">
            {currentLength} / {maxLength}
          </div>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
