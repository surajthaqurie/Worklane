'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/context/AuthContext';
import { useProjects, useProjectOverview } from '@/features/projects/hooks/useProjects';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import { CreateProjectDialog } from '@/features/projects/components/CreateProjectDialog';
import { PageHeader } from '@/components/layout/page-header';
import { Spinner, ErrorState, EmptyState } from '@/shared/components/ui';
import { Folder, Plus, CheckCircle2, Clock, ListTodo, ArrowRight, Bell } from 'lucide-react';

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useProjects();
  const { data: notificationsData } = useNotifications({ limit: 10 });
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const firstProjectId = projects && projects.length > 0 ? projects[0].id : '';
  const { data: overviewData } = useProjectOverview(firstProjectId);

  const stats = overviewData?.stats || {
    todo: 0,
    inProgress: 0,
    done: 0,
    total: 0,
  };

  const notifications = notificationsData?.notifications || [];

  return (
    <div className="w-full flex flex-col space-y-8">
      <PageHeader 
        title={`Welcome back, ${user?.name || 'User'}!`} 
        description="Here is an overview of your active workspaces, task status, and recent activity." 
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Work Summary Stats */}
          <section>
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-[var(--brand-primary)]" />
              Work Item Statistics
            </h2>
            <div className="grid grid-cols-3 gap-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-5 shadow-sm">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-slate-500 text-[13px] mb-1">
                  <ListTodo className="w-3.5 h-3.5 text-slate-400" />
                  To Do / Open
                </div>
                <div className="text-[28px] font-bold text-[var(--text-primary)]">{stats.todo}</div>
              </div>
              <div className="flex flex-col border-l border-[var(--border-subtle)] pl-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-[13px] mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  In Progress
                </div>
                <div className="text-[28px] font-bold text-amber-600 dark:text-amber-400">{stats.inProgress}</div>
              </div>
              <div className="flex flex-col border-l border-[var(--border-subtle)] pl-4">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-[13px] mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Completed
                </div>
                <div className="text-[28px] font-bold text-emerald-600 dark:text-emerald-400">{stats.done}</div>
              </div>
            </div>
          </section>

          {/* Projects Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Folder className="w-4 h-4 text-[var(--brand-primary)]" />
                Workspaces & Projects
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-primary)] hover:opacity-90 text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Project
                </button>
                <Link 
                  href="/projects" 
                  className="text-[13px] text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1 font-medium"
                >
                  View all
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projects.map((p) => (
                  <Link href={`/projects/${p.id}`} key={p.id} className="block group">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] group-hover:border-[var(--brand-primary)] rounded-[var(--radius-card)] p-5 cursor-pointer transition-all shadow-sm group-hover:shadow-md flex flex-col h-full">
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
        </div>

        {/* Sidebar Column: Recent Activity */}
        <div className="space-y-6">
          <section>
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4 text-[var(--brand-primary)]" />
              Recent Activity & Notifications
            </h2>
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-4 shadow-sm min-h-[300px]">
              {notifications.length > 0 ? (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {notifications.map((n) => (
                    <div key={n.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3 text-xs">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[var(--text-primary)] font-medium">
                          {n.actorName || n.actor?.name || 'System'}
                        </p>
                        <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                          {n.type === 'ASSIGNED' ? 'assigned a work item to you' : n.type === 'COMMENT' ? 'commented on a work item' : 'updated a work item'}
                        </p>
                        <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-[var(--text-secondary)]">
                  <Bell className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">No recent activity</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Updates and assigned tasks will appear here.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <CreateProjectDialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
}
