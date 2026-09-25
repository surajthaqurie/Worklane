'use client';

import React, { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import { Menu, Moon, Sun, LogOut, Search } from 'lucide-react';
import { useTheme } from '@/shared/components/providers';
import { GlobalSearch } from '@/shared/components/ui/GlobalSearch';
import { NotificationsPopover } from '@/features/notifications/components/NotificationsPopover';
import { useAuth } from '@/shared/context/AuthContext';
import { OrganizationSwitcher } from '@/features/organizations';
import { useCommandPalette } from '@/components/navigation/CommandPaletteProvider';

const emptySubscribe = () => () => {};

interface AppTopbarProps {
  onMenuClick: () => void;
}

function getInitials(name?: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function AppTopbar({ onMenuClick }: AppTopbarProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const { open: openCommandPalette } = useCommandPalette();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);

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

  // Close dropdown on Escape
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        userButtonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dropdownOpen]);

  return (
    <header
      className="flex items-center justify-between h-14 px-4 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] sm:px-6 z-10 shrink-0"
      role="banner"
    >
      {/* Left section */}
      <div className="flex flex-1 items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="p-1 -ml-1 mr-1 text-[var(--text-secondary)] md:hidden hover:text-[var(--text-primary)] focus-ring rounded transition-colors"
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
        >
          <Menu className="w-5 h-5" aria-hidden />
        </button>

        {/* Org switcher */}
        <OrganizationSwitcher />

        {/* Global search — hidden on mobile (accessible via command palette) */}
        <div className="hidden sm:flex w-full md:ml-0 max-w-md items-center">
          <GlobalSearch />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center ml-4 gap-2 shrink-0">
        {/* Command palette trigger (mobile) */}
        <button
          onClick={openCommandPalette}
          className="flex sm:hidden items-center justify-center w-8 h-8 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus-ring"
          aria-label="Open command palette"
          title="Open command palette (⌘K)"
        >
          <Search className="w-4 h-4" aria-hidden />
        </button>

        {/* Command palette trigger (desktop shortcut hint) */}
        <button
          onClick={openCommandPalette}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus-ring text-[12px]"
          aria-label="Open command palette"
          title="Open command palette"
        >
          <Search className="w-3.5 h-3.5" aria-hidden />
          <span className="hidden md:inline">Commands</span>
          <kbd className="hidden md:inline-flex items-center px-1 border border-[var(--border-default)] rounded bg-[var(--bg-surface)] text-[11px] font-mono text-[var(--text-muted)]">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <NotificationsPopover />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus-ring"
          aria-label={mounted ? (isDark ? 'Switch to light mode' : 'Switch to dark mode') : 'Toggle theme'}
        >
          {mounted ? (
            isDark ? <Sun className="w-4 h-4" aria-hidden /> : <Moon className="w-4 h-4" aria-hidden />
          ) : (
            <div className="w-4 h-4" />
          )}
        </button>

        {/* User menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            ref={userButtonRef}
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 p-0.5 rounded-full hover:bg-[var(--bg-surface-hover)] transition-all focus-ring"
            aria-label={user ? `User menu for ${user.name}` : 'User menu'}
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white border border-[var(--border-subtle)] flex items-center justify-center text-xs font-bold tracking-wider shadow-sm">
              {getInitials(user?.name)}
            </div>
          </button>

          {dropdownOpen && (
            <div
              role="menu"
              aria-label="User account menu"
              className="absolute right-0 mt-2 w-56 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl py-2 z-50"
            >
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
                  role="menuitem"
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-[var(--bg-surface-hover)] transition-colors text-left font-medium focus-ring"
                >
                  <LogOut className="w-4 h-4" aria-hidden />
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
