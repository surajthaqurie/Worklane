'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { globalNavigation } from '../../config/navigation';
import { ChevronLeft, ChevronRight, SquareKanban, Check, Plus, Folder, ChevronDown } from 'lucide-react';
import { useProjects } from '@/features/projects/hooks/useProjects';

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ isCollapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname();

  const projectMatch = pathname?.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch ? projectMatch[1] : undefined;

  const { data: projects = [] } = useProjects();
  const currentProject = projects.find((p) => p.id === projectId);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isActiveGlobal = (match: string) => {
    if (match === '/' && pathname !== '/') return false;
    return pathname.startsWith(match);
  };

  return (
    <div
      className={`flex flex-col h-full bg-[var(--bg-sidebar)] text-[var(--text-primary)] transition-all duration-300 relative ${
        isCollapsed ? 'w-14' : 'w-64'
      }`}
    >
      <div
        className="flex items-center h-14 px-3 border-b border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--bg-surface-hover)] transition-colors"
        onClick={() => !isCollapsed && setIsDropdownOpen(!isDropdownOpen)}
      >
        <div className="flex items-center text-[var(--text-primary)] font-semibold w-full justify-between">
          <div className="flex items-center">
            {currentProject ? (
              <div
                className={`w-6 h-6 rounded-[var(--radius-button)] bg-[var(--bg-surface-selected)] border border-[var(--border-subtle)] flex items-center justify-center text-[10px] font-bold text-[var(--brand-primary)] ${
                  isCollapsed ? 'mx-auto' : 'mr-2'
                }`}
              >
                {currentProject.key || 'P'}
              </div>
            ) : (
              <SquareKanban className={`w-5 h-5 text-[var(--brand-primary)] ${isCollapsed ? 'mx-auto' : 'mr-2'}`} />
            )}
            {!isCollapsed && (
              <span className="text-[14px] truncate max-w-[140px]">
                {currentProject ? currentProject.name : 'TaskForge'}
              </span>
            )}
          </div>
          {!isCollapsed && <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
        </div>
      </div>

      {/* Project Switcher Dropdown */}
      {!isCollapsed && isDropdownOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
          <div className="absolute top-14 left-2 right-2 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] shadow-lg z-50 py-2 flex flex-col max-h-[300px]">
            <div className="px-3 pb-2 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Projects
            </div>
            <div className="overflow-y-auto flex-1">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-surface-hover)] text-[13px] text-[var(--text-primary)]"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[9px] font-bold text-[var(--text-secondary)]">
                      {p.key || 'P'}
                    </div>
                    <span className="truncate max-w-[130px]">{p.name}</span>
                  </div>
                  {projectId === p.id && <Check className="w-4 h-4 text-[var(--brand-primary)]" />}
                </Link>
              ))}
            </div>
            <div className="border-t border-[var(--border-subtle)] mt-1 pt-1">
              <Link
                href="/projects"
                onClick={() => setIsDropdownOpen(false)}
                className="flex items-center px-3 py-2 hover:bg-[var(--bg-surface-hover)] text-[13px] text-[var(--text-secondary)]"
              >
                <Folder className="w-4 h-4 mr-2" /> View all projects
              </Link>
              <button className="w-full flex items-center px-3 py-2 hover:bg-[var(--bg-surface-hover)] text-[13px] text-[var(--text-secondary)]">
                <Plus className="w-4 h-4 mr-2" /> New project
              </button>
            </div>
          </div>
        </>
      )}

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {!isCollapsed && (
          <div className="px-2 pb-2 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
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
              className={`flex items-center px-2 py-1.5 rounded-[var(--radius-button)] text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-[var(--bg-surface-selected)] text-[var(--brand-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon
                className={`flex-shrink-0 w-4 h-4 ${isCollapsed ? 'mx-auto' : 'mr-3'} ${
                  active ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'
                }`}
              />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-end p-2 border-t border-[var(--border-subtle)]">
        <button
          onClick={onToggle}
          className="p-1 rounded-[var(--radius-button)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] focus:outline-none"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4 mx-auto" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
