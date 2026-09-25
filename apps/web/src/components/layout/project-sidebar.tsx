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
  const { project, projectId, can } = useProjectContext();

  const basePath = `/projects/${projectId}`;

  const isActive = (itemMatch: string) => {
    if (itemMatch === '') {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname?.startsWith(`${basePath}${itemMatch}`) ?? false;
  };

  /** Resolve back-link: go to org projects list if we know the orgId */
  const backHref = project?.organizationId
    ? `/orgs/${project.organizationId}/projects`
    : '/projects';

  return (
    <div className="flex flex-col w-64 h-full bg-[var(--bg-surface)] border-r border-[var(--border-subtle)]">
      {/* Back link + project header */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <Link
          href={backHref}
          className="flex items-center text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4 font-medium transition-colors focus-ring"
        >
          <ArrowLeft className="w-4 h-4 mr-2" aria-hidden />
          Projects
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] flex items-center justify-center text-[12px] font-medium text-[var(--text-secondary)] shrink-0">
            {project?.key || 'P'}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span
              className="text-[14px] font-semibold text-[var(--text-primary)] truncate"
              title={project?.name || ''}
            >
              {project?.name || 'Project'}
            </span>
            <span className="text-[12px] text-[var(--text-secondary)]">Project</span>
          </div>
        </div>
      </div>

      {/* Team selector */}
      <TeamSelector />

      {/* Primary project nav */}
      <nav
        className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto"
        aria-label="Project navigation"
      >
        {projectNavigation
          .filter((item) => {
            // Hide permission-gated items when user lacks the permission
            if (item.permission) {
              return can(item.permission as Parameters<typeof can>[0]);
            }
            return true;
          })
          .map((item) => {
            const href = `${basePath}${item.href}`;
            const active = isActive(item.match);
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={href}
                className={`flex items-center px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-button)] group transition-colors focus-ring ${
                  active
                    ? 'bg-[var(--bg-surface-selected)] text-[var(--brand-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  className={`flex-shrink-0 w-4 h-4 mr-3 transition-colors ${
                    active
                      ? 'text-[var(--brand-primary)]'
                      : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
                  }`}
                  aria-hidden
                />
                {item.label}
              </Link>
            );
          })}
      </nav>

      {/* Settings nav */}
      <nav
        className="p-3 border-t border-[var(--border-subtle)] space-y-0.5"
        aria-label="Project settings navigation"
      >
        {projectSettingsNavigation
          .filter((item) => {
            if (item.permission) {
              return can(item.permission as Parameters<typeof can>[0]);
            }
            return true;
          })
          .map((item) => {
            const href = `${basePath}${item.href}`;
            const active = isActive(item.match);
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={href}
                className={`flex items-center px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-button)] group transition-colors focus-ring ${
                  active
                    ? 'bg-[var(--bg-surface-selected)] text-[var(--brand-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  className={`flex-shrink-0 w-4 h-4 mr-3 transition-colors ${
                    active
                      ? 'text-[var(--brand-primary)]'
                      : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
                  }`}
                  aria-hidden
                />
                {item.label}
              </Link>
            );
          })}
      </nav>
    </div>
  );
}
