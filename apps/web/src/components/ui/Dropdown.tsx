'use client';

import React, { useState, useRef, useEffect, useCallback, useId } from 'react';

export interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dropdown({
  trigger,
  children,
  align = 'left',
  className = '',
  isOpen: controlledIsOpen,
  onOpenChange,
}: DropdownProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const setIsOpen = useCallback(
    (value: boolean) => {
      if (controlledIsOpen === undefined) {
        setInternalIsOpen(value);
      }
      onOpenChange?.(value);
      if (!value) {
        setFocusedIndex(-1);
      }
    },
    [controlledIsOpen, onOpenChange]
  );

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    const items = containerRef.current?.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not([disabled])'
    );
    if (!items || items.length === 0) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = focusedIndex + 1 < items.length ? focusedIndex + 1 : 0;
      setFocusedIndex(next);
      items[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = focusedIndex - 1 >= 0 ? focusedIndex - 1 : items.length - 1;
      setFocusedIndex(prev);
      items[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedIndex(0);
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = items.length - 1;
      setFocusedIndex(last);
      items[last]?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onKeyDown={handleKeyDown}
    >
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer inline-flex"
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          tabIndex={-1}
          className={`
            absolute z-[50] mt-1.5 min-w-[180px] p-1
            bg-[var(--bg-surface)] border border-[var(--border-subtle)]
            rounded-[var(--radius-card)] shadow-lg
            ${align === 'right' ? 'right-0' : 'left-0'}
            animate-in fade-in zoom-in-95 duration-100
          `}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
}

export function DropdownItem({
  children,
  icon,
  shortcut,
  danger = false,
  disabled = false,
  className = '',
  onClick,
  ...props
}: DropdownItemProps) {
  return (
    <button
      role="menuitem"
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`
        w-full flex items-center justify-between px-2.5 py-1.5 text-[13px] rounded-[var(--radius-button)]
        text-left select-none outline-none cursor-pointer transition-colors
        ${
          danger
            ? 'text-[var(--semantic-danger-icon)] hover:bg-[var(--semantic-danger-bg)] focus:bg-[var(--semantic-danger-bg)]'
            : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] focus:bg-[var(--bg-surface-hover)]'
        }
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
        ${className}
      `}
      {...props}
    >
      <span className="flex items-center gap-2">
        {icon && <span className="w-4 h-4 shrink-0 text-[var(--text-secondary)]">{icon}</span>}
        <span>{children}</span>
      </span>
      {shortcut && (
        <kbd className="ml-auto text-[10px] text-[var(--text-muted)] tracking-widest pl-3">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

export function DropdownHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider select-none">
      {children}
    </div>
  );
}

export function DropdownDivider() {
  return <div role="separator" className="my-1 border-t border-[var(--border-subtle)]" />;
}
