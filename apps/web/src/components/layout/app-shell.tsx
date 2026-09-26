'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from './app-sidebar';
import { AppTopbar } from './app-topbar';
import { MobileNavigation } from './mobile-navigation';
import { useAuth } from '@/shared/context/AuthContext';
import { LoadingScreen } from '@/components/feedback/Spinner';
import { useSidebarState } from '@/shared/hooks/useSidebarState';
import { CommandPaletteProvider } from '@/components/navigation/CommandPaletteProvider';

/**
 * AppShell — the outermost authenticated layout.
 *
 * Renders:
 *  - Desktop sidebar (collapsed/expanded, state persisted to localStorage)
 *  - Mobile navigation drawer
 *  - Top bar with command palette trigger, breadcrumbs, user menu
 *  - Main content area (scrollable)
 *
 * Route protection: redirects to /login inside useEffect when session is missing.
 * Uses router.replace (not push) so the protected URL doesn't land in history.
 * Returns LoadingScreen while auth is loading or redirecting to prevent render side effects.
 */
export function AppShell({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isLoading } = useAuth();
  const { isCollapsed, toggle } = useSidebarState();
  const router = useRouter();

  // Route protection — redirect inside useEffect to avoid updating Router state during render
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-app)]">
        <LoadingScreen message="Loading session..." />
      </div>
    );
  }

  return (
    <CommandPaletteProvider>
      <div className="flex h-screen bg-[var(--bg-app)] overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:block h-full border-r border-[var(--border-subtle)] shrink-0">
          {sidebar || (
            <AppSidebar
              isCollapsed={isCollapsed}
              onToggle={toggle}
            />
          )}
        </div>

        {/* Mobile Drawer */}
        <MobileNavigation
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />

        {/* Main content */}
        <div className="flex flex-col flex-1 w-0 min-w-0 overflow-hidden">
          <AppTopbar onMenuClick={() => setIsMobileMenuOpen(true)} />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 relative overflow-y-auto focus:outline-none"
          >
            <div className="h-full p-4 md:p-6 max-w-screen-2xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
