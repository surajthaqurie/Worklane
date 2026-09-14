'use client';

import React from 'react';
import { Menu, Search, User, Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../providers';

interface AppTopbarProps {
  onMenuClick: () => void;
}

export function AppTopbar({ onMenuClick }: AppTopbarProps) {
  const { theme, setTheme } = useTheme();

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
        <div className="flex bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] p-0.5">
          <button 
            onClick={() => setTheme('light')} 
            className={`p-1.5 rounded-[calc(var(--radius-button)-2px)] ${theme === 'light' ? 'bg-[var(--bg-surface)] shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            title="Light Mode"
          >
            <Sun className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setTheme('dark')} 
            className={`p-1.5 rounded-[calc(var(--radius-button)-2px)] ${theme === 'dark' ? 'bg-[var(--bg-surface)] shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            title="Dark Mode"
          >
            <Moon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setTheme('system')} 
            className={`p-1.5 rounded-[calc(var(--radius-button)-2px)] ${theme === 'system' ? 'bg-[var(--bg-surface)] shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            title="System Theme"
          >
            <Monitor className="w-4 h-4" />
          </button>
        </div>

        <button className="flex items-center text-[13px] bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white px-3 py-1.5 rounded-[var(--radius-button)] font-medium transition-colors">
          + Create
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
