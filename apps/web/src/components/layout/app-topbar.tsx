'use client';

import React from 'react';
import { Menu, Search, Moon, Sun } from 'lucide-react';
import { useTheme } from '../providers';

interface AppTopbarProps {
  onMenuClick: () => void;
}

export function AppTopbar({ onMenuClick }: AppTopbarProps) {
  const { theme, setTheme } = useTheme();

  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  return (
    <header className="flex items-center justify-between h-14 px-4 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] sm:px-6 lg:px-8 z-10 shrink-0">
      <div className="flex flex-1 items-center">
        <button
          onClick={onMenuClick}
          className="p-1 -ml-1 mr-3 text-[var(--text-secondary)] md:hidden hover:text-[var(--text-primary)] focus:outline-none"
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="flex w-full md:ml-0 max-w-md items-center">
          <div className="relative w-full text-[var(--text-muted)] focus-within:text-[var(--text-primary)] transition-colors">
            <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none pl-3">
              <Search className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              id="search-field"
              className="block w-full py-1.5 pl-9 pr-3 text-[13px] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
              placeholder="Search TaskForge (⌘K)"
              type="search"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center ml-4 md:ml-6 gap-3">
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button className="flex items-center rounded-full focus:outline-none ring-2 ring-transparent hover:ring-[var(--border-focus)] transition-all">
          <span className="sr-only">Open user menu</span>
          <div className="w-7 h-7 rounded-full bg-[var(--bg-surface-selected)] border border-[var(--border-subtle)] flex items-center justify-center text-[12px] font-medium text-[var(--brand-primary)]">
            SC
          </div>
        </button>
      </div>
    </header>
  );
}
