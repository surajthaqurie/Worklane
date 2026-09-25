'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { projectNavigation, projectSettingsNavigation } from '../../config/navigation';
import { ArrowLeft } from 'lucide-react';
import { useProjectContext } from '@/app/(app)/projects/[projectId]/project-layout-client';
import { TeamSelector } from './team-selector';

export function ProjectSidebar() {
  const pathname = usePathname();
  const { project, projectId, can, projectRole } = useProjectContext();

  const isActive = (itemMatch: string) => {
    const basePath = `/projects/${projectId}`;
    if (itemMatch === '') {
      return pathname === basePath;
    }
    return pathname.startsWith(`${basePath}${itemMatch}`);
  };

  return (
    <div className="flex flex-col w-64 h-full bg-[var(--bg-surface)] border-r border-[var(--border-subtle)]">
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <Link
          href={project?.organizationId ? `/orgs/${project.organizationId}/projects` : '/projects'}
          className="flex items-center text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Projects
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] flex items-center justify-center text-[12px] font-medium text-[var(--text-secondary)]">
            {project?.key || 'P'}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span
              className="text-[14px] font-semibold text-[var(--text-primary)] truncate"
              title={project?.name || ''}
            >
              {project?.name || 'Project'}
            </span>
            <span className="text-[12px] text-[var(--text-secondary)]">Workspace</span>
          </div>
        </div>
      </div>

      <TeamSelector />

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {projectNavigation.map((item) => {
          const href = `/projects/${projectId}${item.href || ''}`;
          const active = isActive(item.match);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={href}
              className={`flex items-center px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-button)] group transition-colors ${
                active
                  ? 'bg-[var(--bg-surface-selected)] text-[var(--brand-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon
                className={`flex-shrink-0 w-4 h-4 mr-3 transition-colors ${
                  active
                    ? 'text-[var(--brand-primary)]'
                    : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
                }`}
                aria-hidden="true"
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[var(--border-subtle)]">
        {projectSettingsNavigation
          .filter((item) => {
            if (item.href === '/settings/audit-logs') {
              return can('audit_log:view') || projectRole === 'ADMIN' || projectRole === 'OWNER';
            }
            return true;
          })
          .map((item) => {
          const href = `/projects/${projectId}${item.href}`;
          const active = isActive(item.match);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={href}
              className={`flex items-center px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-button)] group transition-colors ${
                active
                  ? 'bg-[var(--bg-surface-selected)] text-[var(--brand-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon
                className={`flex-shrink-0 w-4 h-4 mr-3 transition-colors ${
                  active
                    ? 'text-[var(--brand-primary)]'
                    : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
                }`}
                aria-hidden="true"
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
