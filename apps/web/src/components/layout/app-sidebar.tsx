'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { globalNavigation } from '../../config/navigation';
import { ChevronLeft, ChevronRight, SquareKanban } from 'lucide-react';

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ isCollapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const navId = useId();

  const isActiveGlobal = (match: string) => {
    if (match === '/' && pathname !== '/') return false;
    return pathname?.startsWith(match) ?? false;
  };

  return (
    <div
      className={`flex flex-col h-full bg-[var(--bg-sidebar)] text-[var(--text-primary)] transition-[width] duration-300 ease-in-out relative ${
        isCollapsed ? 'w-14' : 'w-64'
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo / Brand */}
      <div
        className="flex items-center h-14 px-3 border-b border-[var(--border-subtle)]"
        aria-hidden={isCollapsed ? 'true' : undefined}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-7 h-7 rounded-[var(--radius-button)] bg-[var(--brand-primary)] text-white flex items-center justify-center font-bold shrink-0">
            <SquareKanban className="w-4 h-4" aria-hidden />
          </div>
          {!isCollapsed && (
            <span className="font-bold text-[15px] tracking-tight whitespace-nowrap text-[var(--text-primary)]">
              Worklane
            </span>
          )}
        </div>
      </div>

      {/* Nav Links */}
      <nav
        id={navId}
        className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto"
        aria-label="Workspace navigation"
      >
        {!isCollapsed && (
          <div className="px-2 pb-2 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider select-none">
            Workspace
          </div>
        )}
        {globalNavigation.map((item) => {
          const active = isActiveGlobal(item.match);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center px-2 py-1.5 rounded-[var(--radius-button)] text-[13px] font-medium transition-colors focus-ring ${
                active
                  ? 'bg-[var(--bg-surface-selected)] text-[var(--brand-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
              }`}
              aria-current={active ? 'page' : undefined}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon
                className={`flex-shrink-0 w-4 h-4 ${isCollapsed ? 'mx-auto' : 'mr-3'} ${
                  active ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'
                }`}
                aria-hidden
              />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Toggle button */}
      <div className="flex items-center justify-end p-2 border-t border-[var(--border-subtle)]">
        <button
          onClick={onToggle}
          className="p-1.5 rounded-[var(--radius-button)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] focus-ring transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
          aria-controls={navId}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 mx-auto" aria-hidden />
          ) : (
            <ChevronLeft className="w-4 h-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
