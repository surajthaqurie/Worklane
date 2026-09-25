'use client';

import React, { createContext, useContext, useId } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export interface FormFieldContextValue {
  id: string;
  error?: string | null;
  helpText?: string | null;
  disabled?: boolean;
  required?: boolean;
  isLoading?: boolean;
  isSuccess?: boolean;
  errorId: string;
  helpTextId: string;
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

export function useFormField() {
  return useContext(FormFieldContext);
}

export interface FormFieldProps {
  id?: string;
  label?: React.ReactNode;
  helpText?: string | null;
  error?: string | null;
  successMessage?: string | null;
  required?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  id: explicitId,
  label,
  helpText,
  error,
  successMessage,
  required = false,
  disabled = false,
  isLoading = false,
  className = '',
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const errorId = `${id}-error`;
  const helpTextId = `${id}-help`;
  const isSuccess = !!successMessage && !error;

  return (
    <FormFieldContext.Provider
      value={{
        id,
        error,
        helpText,
        disabled,
        required,
        isLoading,
        isSuccess,
        errorId,
        helpTextId,
      }}
    >
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {label && (
          <div className="flex items-center justify-between">
            <label
              htmlFor={id}
              className={`
                text-[13px] font-medium select-none
                ${disabled ? 'text-[var(--text-disabled)]' : 'text-[var(--text-secondary)]'}
              `}
            >
              {label}
              {required && (
                <span className="text-[var(--semantic-danger-icon)] ml-0.5" aria-hidden="true">
                  *
                </span>
              )}
            </label>
            {required && <span className="sr-only">(required)</span>}
          </div>
        )}

        <div className="relative">{children}</div>

        {error ? (
          <div
            id={errorId}
            role="alert"
            className="flex items-center gap-1.5 text-[12px] text-[var(--semantic-danger-text)] animate-in fade-in duration-100"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[var(--semantic-danger-icon)]" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : isSuccess ? (
          <div
            className="flex items-center gap-1.5 text-[12px] text-[var(--semantic-success-text)] animate-in fade-in duration-100"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[var(--semantic-success-icon)]" aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
        ) : helpText ? (
          <p id={helpTextId} className="text-[12px] text-[var(--text-muted)]">
            {helpText}
          </p>
        ) : null}
      </div>
    </FormFieldContext.Provider>
  );
}
