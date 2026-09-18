'use client';

import React, { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import { Menu, Moon, Sun, LogOut, User as UserIcon } from 'lucide-react';
import { useTheme } from '@/shared/components/providers';
import { GlobalSearch } from '@/shared/components/ui/GlobalSearch';
import { NotificationsPopover } from '@/features/notifications/components/NotificationsPopover';
import { useAuth } from '@/shared/context/AuthContext';

const emptySubscribe = () => () => {};

interface AppTopbarProps {
  onMenuClick: () => void;
}

export function AppTopbar({ onMenuClick }: AppTopbarProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

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

        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-[var(--bg-surface-hover)] transition-all focus:outline-none"
            title={user ? user.name : 'User Menu'}
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white border border-[var(--border-subtle)] flex items-center justify-center text-xs font-bold tracking-wider shadow-sm">
              {getInitials(user?.name)}
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl py-2 z-50">
              <div className="px-4 py-2 border-b border-[var(--border-subtle)]">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-[var(--text-secondary)] truncate">
                  {user?.email || 'user@example.com'}
                </p>
              </div>

              <div className="pt-1">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-[var(--bg-surface-hover)] transition-colors text-left font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
