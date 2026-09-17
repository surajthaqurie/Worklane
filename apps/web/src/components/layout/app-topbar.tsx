'use client';

import React from 'react';
import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from '../providers';
import { GlobalSearch } from '@/shared/components/ui/GlobalSearch';
import { NotificationsPopover } from '@/features/notifications/components/NotificationsPopover';

interface AppTopbarProps {
  onMenuClick: () => void;
}

export function AppTopbar({ onMenuClick }: AppTopbarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

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
          <GlobalSearch />
        </div>
      </div>
      <div className="flex items-center ml-4 md:ml-6 gap-3">
        <NotificationsPopover />

        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title={mounted ? (isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode') : 'Toggle Theme'}
        >
          {mounted ? (
            isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />
          ) : (
            <div className="w-4 h-4" />
          )}
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
