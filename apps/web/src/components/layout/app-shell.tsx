'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from './app-sidebar';
import { AppTopbar } from './app-topbar';
import { MobileNavigation } from './mobile-navigation';
import { useAuth } from '@/shared/context/AuthContext';

export function AppShell({ children, sidebar }: { children: React.ReactNode, sidebar?: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-app)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-[var(--bg-app)] overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full border-r border-[var(--border-subtle)]">
        {sidebar || (
          <AppSidebar 
            isCollapsed={isSidebarCollapsed} 
            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          />
        )}
      </div>

      {/* Mobile Navigation Drawer */}
      <MobileNavigation 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <AppTopbar onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 md:p-8">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
