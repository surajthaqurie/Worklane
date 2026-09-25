'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/context/AuthContext';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { CreateProjectDialog } from '@/features/projects/components/CreateProjectDialog';
import { PageHeader } from '@/components/layout/page-header';
import { Spinner, ErrorState, EmptyState } from '@/shared/components/ui';
import { Folder, Plus, ArrowRight } from 'lucide-react';
import { DashboardGrid } from '@/features/dashboards';
import { WorkItemDrawer } from '@/features/work-items/components/WorkItemDrawer';
import { useWorkItemDetail } from '@/features/work-items/hooks/useWorkItems';

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-12">
          <Spinner size="lg" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null);

  const { data: drawerItem } = useWorkItemDetail(drawerItemId || '');

  return (
    <div className="w-full flex flex-col space-y-8">
      {/* Top Header with Project Scope Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title={`Welcome back, ${user?.name || 'User'}!`}
          description="Your customizable dashboard for tracking sprint health, blockers, work items, and throughput."
        />

        <div className="flex items-center gap-3 shrink-0">
          {/* Project Scope Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--text-muted)]">Scope:</span>
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value || null)}
              className="rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-xs focus:outline-hidden"
              aria-label="Filter dashboard by project"
            >
              <option value="">All Projects (Global)</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-primary)] hover:opacity-90 text-white text-xs font-medium rounded-[var(--radius-button)] transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Interactive Dashboard Grid System */}
      <section>
        <DashboardGrid
          projectId={selectedProjectId}
          onOpenWorkItem={(id) => setDrawerItemId(id)}
        />
      </section>

      {/* Workspaces & Projects Directory Section */}
      <section className="pt-6 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Folder className="w-4 h-4 text-[var(--brand-primary)]" />
            Workspaces & Projects
          </h2>
          <Link
            href="/projects"
            className="text-[13px] text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1 font-medium"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {projectsLoading && (
          <div className="flex justify-center p-8 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)]">
            <Spinner size="md" />
          </div>
        )}

        {projectsError && (
          <ErrorState error={projectsError} title="Failed to load projects" />
        )}

        {!projectsLoading && !projectsError && projects && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link href={`/projects/${p.id}`} key={p.id} className="block group">
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] group-hover:border-[var(--brand-primary)] rounded-[var(--radius-card)] p-5 cursor-pointer transition-all shadow-xs group-hover:shadow-sm flex flex-col h-full">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center font-bold text-sm">
                        {p.key || p.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">
                          {p.name}
                        </h3>
                        <span className="text-[11px] font-mono text-[var(--text-muted)]">
                          KEY: {p.key}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[13px] text-[var(--text-secondary)] line-clamp-2 mb-4 flex-1">
                    {p.description || 'No project description provided.'}
                  </p>
                  <div className="text-[11px] text-[var(--text-muted)] pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <span>Created {new Date(p.createdAt).toLocaleDateString()}</span>
                    <span className="font-medium text-[var(--brand-primary)] group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
                      Open project &rarr;
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!projectsLoading && !projectsError && (!projects || projects.length === 0) && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-6">
            <EmptyState
              title="No projects yet"
              description="Create your first workspace project to start managing tasks and boards."
              action={
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--brand-primary)] text-white text-xs font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Create Project
                </button>
              }
            />
          </div>
        )}
      </section>

      {/* Drawer */}
      {drawerItem && (
        <WorkItemDrawer
          item={drawerItem}
          onClose={() => setDrawerItemId(null)}
        />
      )}

      <CreateProjectDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
