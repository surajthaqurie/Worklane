'use client';

import { Suspense, use, useState } from 'react';
import Link from 'next/link';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { useOrganization } from '@/features/organizations';
import { CreateProjectDialog } from '@/features/projects/components/CreateProjectDialog';
import { Folder, Plus, Search, Building2, ExternalLink } from 'lucide-react';
import { Spinner, ErrorState, EmptyState } from '@/shared/components/ui';
import { AppShell } from '@/components/layout/app-shell';

export default function OrgProjectsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <OrgProjectsPageContent params={params} />
    </Suspense>
  );
}

function OrgProjectsPageContent({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const resolved = use(params);
  const { data: organization } = useOrganization(resolved.orgId);
  const { data: projects, isLoading, error } = useProjects(resolved.orgId);

  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filteredProjects = (projects || []).filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.key.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell>
      <div className="w-full flex flex-col h-full p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-4 border-b border-[var(--border-subtle)] shrink-0 gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                {organization?.name || 'Organization'}
              </span>
            </div>
            <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">
              Projects
            </h1>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
              Workspaces and projects belonging to {organization?.name || 'this organization'}.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--brand-primary)] hover:opacity-90 text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-opacity shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Project</span>
            </button>
          </div>
        </div>

        {/* Search */}
        {(projects?.length || 0) > 0 && (
          <div className="mb-6 max-w-sm">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--text-muted)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter organization projects..."
                className="w-full pl-9 pr-3 py-1.5 text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--brand-primary)]"
              />
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center p-12">
            <Spinner size="lg" />
          </div>
        )}

        {error && <ErrorState error={error} title="Failed to load organization projects" />}

        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 content-start">
            {filteredProjects.map((project) => (
              <Link
                href={`/orgs/${resolved.orgId}/projects/${project.id}`}
                key={project.id}
              >
                <div className="border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-5 hover:border-[var(--border-strong)] transition-all bg-[var(--bg-surface)] cursor-pointer h-full flex flex-col group shadow-2xs hover:shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] flex items-center justify-center text-[var(--brand-primary)] font-bold text-[11px]">
                        <Folder className="w-4 h-4" />
                      </div>
                      <h2 className="text-[15px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">
                        {project.name}
                      </h2>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--bg-surface-hover)] px-2 py-1 rounded-[var(--radius-button)] border border-[var(--border-subtle)]">
                      {project.key}
                    </span>
                  </div>

                  <p className="text-[13px] text-[var(--text-secondary)] mb-6 flex-1 line-clamp-3">
                    {project.description || 'No description provided for this project.'}
                  </p>

                  <div className="flex justify-between items-center text-[11px] text-[var(--text-muted)] pt-3 border-t border-[var(--border-subtle)]">
                    <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
                    <span className="inline-flex items-center gap-1 group-hover:text-[var(--brand-primary)]">
                      <span>Open Workspace</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}

            {filteredProjects.length === 0 && projects && projects.length > 0 && (
              <div className="col-span-full py-8 text-center text-[13px] text-[var(--text-muted)]">
                No projects matching &quot;{search}&quot;.
              </div>
            )}

            {projects?.length === 0 && (
              <div className="col-span-full">
                <EmptyState
                  title="No projects in this organization yet"
                  description="Create your first project within this organization to get started."
                />
              </div>
            )}
          </div>
        )}

        <CreateProjectDialog
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          defaultOrganizationId={resolved.orgId}
        />
      </div>
    </AppShell>
  );
}
