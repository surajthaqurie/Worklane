'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { globalNavigation, projectNavigation, projectSettingsNavigation } from '../../config/navigation';
import { X, SquareKanban } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';

interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavigation({ isOpen, onClose }: MobileNavigationProps) {
  const pathname = usePathname();

  // Focus trap inside drawer when open — hook returns ref to attach to the container
  const drawerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen, restoreFocus: true });

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const projectMatch = pathname?.match(/\/projects\/([^/]+)/);
  const projectId = projectMatch ? projectMatch[1] : undefined;

  const isActiveGlobal = (match: string) => {
    if (match === '/' && pathname !== '/') return false;
    return pathname?.startsWith(match) ?? false;
  };

  const isActiveProject = (itemMatch: string) => {
    if (!projectId) return false;
    const basePath = `/projects/${projectId}`;
    if (itemMatch === '') {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname?.startsWith(`${basePath}${itemMatch}`) ?? false;
  };

  return (
    <>
      {/* Backdrop — always rendered so CSS transitions work */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity duration-200 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-full max-w-xs bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] shadow-2xl transform transition-transform duration-200 ease-in-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[var(--radius-button)] bg-[var(--brand-primary)] text-white flex items-center justify-center font-bold">
              <SquareKanban className="w-4 h-4" aria-hidden />
            </div>
            <span className="font-bold text-[15px] tracking-tight">Worklane</span>
          </div>
          <IconButton
            icon={<X className="w-5 h-5" aria-hidden />}
            aria-label="Close navigation menu"
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </div>

        {/* Nav content */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav aria-label="Mobile navigation" className="px-3 space-y-0.5">
            {projectId ? (
              <>
                {/* Back to projects */}
                <Link
                  href="/projects"
                  onClick={onClose}
                  className="flex items-center px-3 py-2 mb-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-button)] hover:bg-[var(--bg-surface-hover)] transition-colors focus-ring"
                >
                  ← All Projects
                </Link>

                {/* Project nav items */}
                {projectNavigation.map((item) => {
                  const href = `/projects/${projectId}${item.href}`;
                  const active = isActiveProject(item.match);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.label}
                      href={href}
                      onClick={onClose}
                      className={`flex items-center px-3 py-2 text-[13px] font-medium rounded-[var(--radius-button)] transition-colors focus-ring ${
                        active
                          ? 'bg-[var(--brand-primary)] text-white'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                      }`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon className="shrink-0 w-4 h-4 mr-3" aria-hidden />
                      {item.label}
                    </Link>
                  );
                })}

                {/* Project settings */}
                <div className="pt-3 mt-3 border-t border-[var(--border-subtle)]">
                  {projectSettingsNavigation.map((item) => {
                    const href = `/projects/${projectId}${item.href}`;
                    const active = isActiveProject(item.match);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.label}
                        href={href}
                        onClick={onClose}
                        className={`flex items-center px-3 py-2 text-[13px] font-medium rounded-[var(--radius-button)] transition-colors focus-ring ${
                          active
                            ? 'bg-[var(--brand-primary)] text-white'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                        }`}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon className="shrink-0 w-4 h-4 mr-3" aria-hidden />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Global workspace nav */
              globalNavigation.map((item) => {
                const active = isActiveGlobal(item.match);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center px-3 py-2 text-[13px] font-medium rounded-[var(--radius-button)] transition-colors focus-ring ${
                      active
                        ? 'bg-[var(--brand-primary)] text-white'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="shrink-0 w-4 h-4 mr-3" aria-hidden />
                    {item.label}
                  </Link>
                );
              })
            )}
          </nav>
        </div>
      </div>
    </>
  );
}
