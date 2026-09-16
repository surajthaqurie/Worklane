'use client';

import React, { useState } from 'react';
import { AppSidebar } from './app-sidebar';
import { AppTopbar } from './app-topbar';
import { MobileNavigation } from './mobile-navigation';

export function AppShell({ children, sidebar }: { children: React.ReactNode, sidebar?: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
