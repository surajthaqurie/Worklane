'use client';

import React, { useState, useEffect, useRef, useId, useMemo } from 'react';
import { Search, ArrowRight } from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  category?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  keywords?: string[];
  onSelect: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
}

export function CommandPalette({
  isOpen,
  onClose,
  items,
  placeholder = 'Type a command or search...',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Adjust state when open state changes without cascading render
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  }, [items, query]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredItems.forEach((item) => {
      const cat = item.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems]);

  // Flattened array for index tracking
  const flatVisible = useMemo(() => {
    return Object.values(groupedItems).flat();
  }, [groupedItems]);

  const handleSelect = (item: CommandItem) => {
    onClose();
    item.onSelect();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < flatVisible.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : flatVisible.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatVisible[selectedIndex]) {
        handleSelect(flatVisible[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  let runningIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-dialog)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        onKeyDown={handleKeyDown}
      >
        {/* Search header */}
        <div className="flex items-center px-4 py-3.5 border-b border-[var(--border-subtle)] gap-3 bg-[var(--bg-surface)]">
          <Search className="w-5 h-5 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={placeholder}
            className="w-full text-[14px] bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 border border-[var(--border-default)] rounded bg-[var(--bg-surface-hover)] text-[var(--text-muted)]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="max-h-80 overflow-y-auto p-2 flex flex-col gap-3"
        >
          {flatVisible.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--text-muted)]">
              No matching commands or pages
            </div>
          ) : (
            Object.entries(groupedItems).map(([category, catItems]) => (
              <div key={category} className="flex flex-col gap-1">
                <div className="px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider select-none">
                  {category}
                </div>
                {catItems.map((item) => {
                  const currentIndex = runningIndex++;
                  const isSelected = currentIndex === selectedIndex;

                  return (
                    <div
                      key={item.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`
                        flex items-center justify-between px-3 py-2 rounded-[var(--radius-button)] text-[13px]
                        cursor-pointer select-none transition-colors
                        ${
                          isSelected
                            ? 'bg-[var(--brand-primary)] text-white'
                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <span
                          className={`w-4 h-4 shrink-0 ${
                            isSelected ? 'text-white' : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {item.icon || <ArrowRight className="w-4 h-4" />}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium truncate">{item.label}</span>
                          {item.description && (
                            <span
                              className={`text-[11px] truncate ${
                                isSelected ? 'text-white/80' : 'text-[var(--text-muted)]'
                              }`}
                            >
                              {item.description}
                            </span>
                          )}
                        </div>
                      </div>

                      {item.shortcut && (
                        <kbd
                          className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-[var(--bg-surface-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                          }`}
                        >
                          {item.shortcut}
                        </kbd>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1 bg-[var(--bg-surface)] border rounded">↑</kbd>
              <kbd className="px-1 bg-[var(--bg-surface)] border rounded">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1 bg-[var(--bg-surface)] border rounded">↵</kbd>
              <span>to select</span>
            </span>
          </div>
          <span>Worklane Commands</span>
        </div>
      </div>
    </div>
  );
}
