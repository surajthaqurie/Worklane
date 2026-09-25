'use client';

import React, { createContext, useContext, forwardRef, useId } from 'react';

interface RadioGroupContextValue {
  name: string;
  value?: string;
  onChange?: (val: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps {
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  children: React.ReactNode;
}

export function RadioGroup({
  name: explicitName,
  value,
  onChange,
  disabled = false,
  orientation = 'vertical',
  className = '',
  children,
}: RadioGroupProps) {
  const generatedName = useId();
  const name = explicitName || generatedName;

  return (
    <RadioGroupContext.Provider value={{ name, value, onChange, disabled }}>
      <div
        role="radiogroup"
        className={`flex ${orientation === 'horizontal' ? 'flex-row gap-4' : 'flex-col gap-2.5'} ${className}`}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  (
    {
      value,
      label,
      description,
      disabled: propDisabled,
      id: propId,
      className = '',
      ...props
    },
    ref
  ) => {
    const group = useContext(RadioGroupContext);
    const generatedId = useId();
    const id = propId || generatedId;

    const isChecked = group ? group.value === value : props.checked;
    const isDisabled = propDisabled !== undefined ? propDisabled : group?.disabled;

    const handleChange = () => {
      group?.onChange?.(value);
    };

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
            ref={ref}
            id={id}
            type="radio"
            name={group?.name || props.name}
            value={value}
            checked={isChecked}
            disabled={isDisabled}
            onChange={handleChange}
            className="sr-only peer"
            {...props}
          />
          <div
            className={`
              w-4 h-4 rounded-full border transition-colors flex items-center justify-center
              peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--border-focus)] peer-focus-visible:ring-offset-1
              ${
                isChecked
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-default)] group-hover:border-[var(--border-strong)]'
              }
            `}
          >
            {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
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

Radio.displayName = 'Radio';
