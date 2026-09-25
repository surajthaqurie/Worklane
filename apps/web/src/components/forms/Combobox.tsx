'use client';

import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { useFormField } from './FormField';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: boolean | string;
  clearable?: boolean;
  className?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  disabled: propDisabled,
  error: propError,
  clearable = false,
  className = '',
}: ComboboxProps) {
  const formField = useFormField();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const isDisabled = propDisabled !== undefined ? propDisabled : formField?.disabled;
  const hasError = !!propError || !!formField?.error;

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.description?.toLowerCase().includes(q)
    );
  }, [options, search]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange?.(val);
    setIsOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearch('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) =>
        prev + 1 < filteredOptions.length ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) =>
        prev - 1 >= 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
        const target = filteredOptions[focusedIndex];
        if (!target.disabled) {
          handleSelect(target.value);
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        disabled={isDisabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between h-9 px-3 text-[13px] rounded-[var(--radius-input)] border
          bg-[var(--bg-surface)] text-[var(--text-primary)] text-left transition-colors outline-none
          focus-visible:ring-2 focus-visible:ring-offset-1
          ${
            hasError
              ? 'border-[var(--semantic-danger-icon)] focus-visible:border-[var(--semantic-danger-icon)] focus-visible:ring-[var(--semantic-danger-icon)]/20'
              : 'border-[var(--border-default)] hover:border-[var(--border-strong)] focus-visible:border-[var(--border-focus)] focus-visible:ring-[var(--border-focus)]/20'
          }
          disabled:bg-[var(--bg-surface-hover)] disabled:text-[var(--text-disabled)] disabled:cursor-not-allowed
        `}
      >
        <span className={selectedOption ? 'truncate' : 'text-[var(--text-muted)] truncate'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1 text-[var(--text-muted)] shrink-0 ml-2">
          {clearable && value && !isDisabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange?.('');
              }}
              className="p-0.5 hover:text-[var(--text-primary)] rounded-full focus:outline-none"
              aria-label="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronsUpDown className="w-4 h-4" aria-hidden="true" />
        </div>
      </button>

      {/* Dropdown Listbox */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1.5 w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Search Input */}
          <div className="flex items-center px-2.5 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] gap-2">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full text-[12px] bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
            />
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-3 text-center text-[12px] text-[var(--text-muted)]">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isFocused = idx === focusedIndex;

                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled}
                    onClick={() => !opt.disabled && handleSelect(opt.value)}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    className={`
                      flex items-center justify-between px-2.5 py-1.5 text-[13px] rounded-[var(--radius-button)]
                      cursor-pointer select-none transition-colors
                      ${
                        isFocused || isSelected
                          ? 'bg-[var(--bg-surface-hover)] text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)]'
                      }
                      ${opt.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
                    `}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="truncate">{opt.label}</span>
                      {opt.description && (
                        <span className="text-[11px] text-[var(--text-muted)] truncate">
                          {opt.description}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0" aria-hidden="true" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
