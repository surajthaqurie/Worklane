'use client';

import React, { createContext, useContext, useState, useRef, useId } from 'react';

export type TabsVariant = 'underline' | 'pills';

interface TabsContextValue {
  value: string;
  onValueChange: (val: string) => void;
  variant: TabsVariant;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error('Tabs compound components must be rendered within <Tabs>');
  }
  return ctx;
}

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: TabsVariant;
  className?: string;
  children: React.ReactNode;
}

export function Tabs({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  variant = 'underline',
  className = '',
  children,
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const baseId = useId();

  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = (val: string) => {
    if (!isControlled) {
      setUncontrolledValue(val);
    }
    onValueChange?.(val);
  };

  return (
    <TabsContext.Provider
      value={{
        value: activeValue,
        onValueChange: handleValueChange,
        variant,
        baseId,
      }}
    >
      <div className={`flex flex-col w-full ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabListProps {
  className?: string;
  children: React.ReactNode;
}

export function TabList({ className = '', children }: TabListProps) {
  const { variant } = useTabsContext();
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])') || []
    );
    if (tabs.length === 0) return;

    const currentIndex = tabs.findIndex((t) => t === document.activeElement);
    if (currentIndex === -1) return;

    let targetIndex = -1;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      targetIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      targetIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      targetIndex = tabs.length - 1;
    }

    if (targetIndex !== -1) {
      const target = tabs[targetIndex];
      target?.focus();
      target?.click();
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={handleKeyDown}
      className={`
        flex items-center gap-1 select-none overflow-x-auto
        ${
          variant === 'underline'
            ? 'border-b border-[var(--border-subtle)]'
            : 'p-1 bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] inline-flex w-fit'
        }
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export interface TabProps {
  value: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Tab({
  value,
  icon,
  disabled = false,
  className = '',
  children,
}: TabProps) {
  const { value: activeValue, onValueChange, variant, baseId } = useTabsContext();
  const isSelected = activeValue === value;
  const tabId = `${baseId}-tab-${value}`;
  const panelId = `${baseId}-panel-${value}`;

  return (
    <button
      id={tabId}
      role="tab"
      type="button"
      tabIndex={isSelected ? 0 : -1}
      aria-selected={isSelected}
      aria-controls={panelId}
      disabled={disabled}
      onClick={() => !disabled && onValueChange(value)}
      className={`
        inline-flex items-center gap-2 text-[13px] font-medium transition-colors cursor-pointer outline-none whitespace-nowrap
        focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${
          variant === 'underline'
            ? `px-3.5 py-2.5 -mb-px border-b-2 ${
                isSelected
                  ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] font-semibold'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)]'
              }`
            : `px-3 py-1.5 rounded-[var(--radius-button)] ${
                isSelected
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`
        }
        ${className}
      `}
    >
      {icon && <span className="w-4 h-4 shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export interface TabPanelProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export function TabPanel({ value, className = '', children }: TabPanelProps) {
  const { value: activeValue, baseId } = useTabsContext();
  const isSelected = activeValue === value;
  const tabId = `${baseId}-tab-${value}`;
  const panelId = `${baseId}-panel-${value}`;

  if (!isSelected) return null;

  return (
    <div
      id={panelId}
      role="tabpanel"
      tabIndex={0}
      aria-labelledby={tabId}
      className={`pt-4 outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-focus)] animate-in fade-in duration-100 ${className}`}
    >
      {children}
    </div>
  );
}
