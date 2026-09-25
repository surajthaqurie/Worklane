'use client';

import React, { forwardRef, useId } from 'react';
import { useFormField } from './FormField';

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
  id?: string;
}

const sizeConfig = {
  sm: {
    track: 'w-7 h-4',
    thumb: 'w-3 h-3',
    translate: 'translate-x-3',
  },
  md: {
    track: 'w-9 h-5',
    thumb: 'w-4 h-4',
    translate: 'translate-x-4',
  },
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked,
      onChange,
      disabled: propDisabled,
      label,
      description,
      size = 'md',
      className = '',
      id: propId,
    },
    ref
  ) => {
    const formField = useFormField();
    const generatedId = useId();
    const id = propId || formField?.id || generatedId;
    const isDisabled = propDisabled !== undefined ? propDisabled : formField?.disabled;
    const config = sizeConfig[size];

    const handleClick = () => {
      if (!isDisabled) {
        onChange?.(!checked);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleClick();
      }
    };

    return (
      <div className={`inline-flex items-start gap-2.5 select-none ${className}`}>
        <button
          ref={ref}
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={isDisabled}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={`
            relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors p-0.5 outline-none mt-0.5
            focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1
            ${config.track}
            ${checked ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border-strong)]'}
            ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <span
            className={`
              pointer-events-none inline-block rounded-full bg-white shadow-xs transition-transform duration-150
              ${config.thumb}
              ${checked ? config.translate : 'translate-x-0'}
            `}
          />
        </button>

        {(label || description) && (
          <label htmlFor={id} className="flex flex-col cursor-pointer" onClick={handleClick}>
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
          </label>
        )}
      </div>
    );
  }
);

Switch.displayName = 'Switch';
