'use client';

import React, { forwardRef, useEffect, useRef } from 'react';
import { Check, Minus } from 'lucide-react';
import { useFormField } from './FormField';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  indeterminate?: boolean;
  error?: boolean | string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      description,
      indeterminate = false,
      error: propError,
      checked,
      disabled: propDisabled,
      id: propId,
      className = '',
      onChange,
      ...props
    },
    ref
  ) => {
    const formField = useFormField();
    const internalRef = useRef<HTMLInputElement>(null);

    const id = propId || formField?.id;
    const hasError = !!propError || !!formField?.error;
    const isDisabled = propDisabled !== undefined ? propDisabled : formField?.disabled;

    useEffect(() => {
      if (internalRef.current) {
        internalRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    return (
      <label
        htmlFor={id}
        className={`
          inline-flex items-start gap-2.5 cursor-pointer select-none group
          ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}
          ${className}
        `}
      >
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            ref={(node) => {
              // Handle both forwarded ref and internal ref
              (internalRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
              if (typeof ref === 'function') ref(node);
              else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
            }}
            id={id}
            type="checkbox"
            checked={checked}
            disabled={isDisabled}
            onChange={onChange}
            className="sr-only peer"
            {...props}
          />
          <div
            className={`
              w-4 h-4 rounded-[var(--radius-xs)] border transition-colors flex items-center justify-center
              peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--border-focus)] peer-focus-visible:ring-offset-1
              ${
                checked || indeterminate
                  ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white'
                  : 'bg-[var(--bg-surface)] border-[var(--border-default)] group-hover:border-[var(--border-strong)]'
              }
              ${hasError ? 'border-[var(--semantic-danger-icon)]' : ''}
            `}
          >
            {indeterminate ? (
              <Minus className="w-3 h-3 stroke-[3]" aria-hidden="true" />
            ) : checked ? (
              <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />
            ) : null}
          </div>
        </div>

        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <span
                className={`
                  text-[13px] font-medium leading-tight
                  ${isDisabled ? 'text-[var(--text-disabled)]' : 'text-[var(--text-primary)]'}
                `}
              >
                {label}
              </span>
            )}
            {description && (
              <span className="text-[12px] text-[var(--text-muted)] mt-0.5 leading-tight">
                {description}
              </span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
