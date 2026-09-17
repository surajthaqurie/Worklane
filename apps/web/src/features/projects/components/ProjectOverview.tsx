'use client';

import React from 'react';
import { useProjectOverview } from '../hooks/useProjects';
import { format } from 'date-fns';
import { Spinner, ErrorState, EmptyState } from '@/shared/components/ui';

interface ActivityItem {
  id: string;
  user_name?: string;
  actorName?: string;
  action: string;
  work_item_seq?: number | string;
  work_item_title?: string;
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
}

export function ProjectOverview({ projectId }: { projectId: string }) {
  const { data, isLoading, error, refetch } = useProjectOverview(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  if (!data) {
    return <EmptyState title="No project overview available" />;
  }

  const rawData = data as unknown as Record<string, unknown>;
  const stats = (rawData.stats || {
    total: data.totalWorkItems || 0,
    todo: data.openWorkItems || 0,
    inProgress: 0,
    done: data.completedWorkItems || 0,
    bugs: 0,
  }) as {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    bugs: number;
  };

  const activeIteration = rawData.activeIteration as {
    name: string;
    start_date?: string;
    startDate?: string;
    end_date?: string;
    endDate?: string;
    completedItems?: number;
    remainingItems?: number;
    progress?: number;
  } | null;

  const recentActivity = (rawData.recentActivity || []) as ActivityItem[];

  const total = stats.total || 1;
  const todoPct = (stats.todo / total) * 100;
  const inProgPct = (stats.inProgress / total) * 100;
  const donePct = (stats.done / total) * 100;

  const startDate = activeIteration?.start_date || activeIteration?.startDate;
  const endDate = activeIteration?.end_date || activeIteration?.endDate;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Project Overview Stats */}
        <div className="flex flex-col gap-4 border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-6 bg-[var(--bg-surface)] shadow-sm">
          <h2 className="text-xl font-medium mb-2 text-[var(--text-primary)]">Project Overview</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-sm text-[var(--text-secondary)]">Total Work Items</span>
              <span className="text-2xl font-semibold text-[var(--text-primary)]">{stats.total}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-[var(--text-secondary)]">Bugs</span>
              <span className="text-2xl font-semibold text-[var(--text-primary)]">{stats.bugs}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-[var(--text-secondary)]">To Do</span>
              <span className="text-2xl font-semibold text-[var(--text-primary)]">{stats.todo}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-[var(--text-secondary)]">In Progress</span>
              <span className="text-2xl font-semibold text-[var(--text-primary)]">{stats.inProgress}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-[var(--text-secondary)]">Done</span>
              <span className="text-2xl font-semibold text-[var(--text-primary)]">{stats.done}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
            <h3 className="text-sm font-medium mb-2 text-[var(--text-primary)]">Work Distribution</h3>
            <div className="flex h-4 w-full rounded-full overflow-hidden bg-[var(--bg-surface-hover)]">
              {stats.todo > 0 && (
                <div style={{ width: `${todoPct}%` }} className="bg-gray-400 dark:bg-gray-600" title={`To Do: ${stats.todo}`} />
              )}
              {stats.inProgress > 0 && (
                <div style={{ width: `${inProgPct}%` }} className="bg-blue-500" title={`In Progress: ${stats.inProgress}`} />
              )}
              {stats.done > 0 && (
                <div style={{ width: `${donePct}%` }} className="bg-emerald-500" title={`Done: ${stats.done}`} />
              )}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600" />
                To Do
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                In Progress
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Done
              </div>
            </div>
          </div>
        </div>

        {/* Current Iteration */}
        <div className="flex flex-col gap-4 border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-6 bg-[var(--bg-surface)] shadow-sm">
          <h2 className="text-xl font-medium mb-2 text-[var(--text-primary)]">Current Iteration</h2>
          {activeIteration ? (
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-lg font-medium text-[var(--text-primary)]">{activeIteration.name}</div>
                {startDate && endDate && (
                  <div className="text-sm text-[var(--text-secondary)]">
                    {format(new Date(startDate), 'MMM d, yyyy')} - {format(new Date(endDate), 'MMM d, yyyy')}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="flex flex-col">
                  <span className="text-sm text-[var(--text-secondary)]">Completed Items</span>
                  <span className="text-2xl font-semibold text-emerald-600 dark:text-emerald-500">
                    {activeIteration.completedItems ?? 0}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-[var(--text-secondary)]">Remaining Items</span>
                  <span className="text-2xl font-semibold text-[var(--text-primary)]">
                    {activeIteration.remainingItems ?? 0}
                  </span>
                </div>
              </div>

              {activeIteration.progress !== undefined && (
                <div className="mt-2">
                  <div className="flex justify-between text-sm mb-1 text-[var(--text-primary)]">
                    <span>Iteration Progress</span>
                    <span className="font-medium">{activeIteration.progress}%</span>
                  </div>
                  <div className="flex h-2 w-full rounded-full overflow-hidden bg-[var(--bg-surface-hover)]">
                    <div style={{ width: `${activeIteration.progress}%` }} className="bg-emerald-500" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[var(--text-secondary)] flex items-center justify-center h-full pb-8">
              No active iteration right now.
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="flex flex-col gap-4 border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-6 bg-[var(--bg-surface)] shadow-sm">
        <h2 className="text-xl font-medium mb-4 text-[var(--text-primary)]">Recent Activity</h2>
        {recentActivity.length > 0 ? (
          <div className="flex flex-col gap-4 divide-y divide-[var(--border-subtle)]">
            {recentActivity.map((act) => (
              <div key={act.id} className="pt-4 flex flex-col gap-1 first:pt-0">
                <div className="text-sm text-[var(--text-primary)]">
                  <span className="font-medium">{act.user_name || act.actorName || 'User'}</span>{' '}
                  <span className="text-[var(--text-secondary)]">
                    {act.action === 'CREATED' ? 'created' : 'updated'}
                  </span>{' '}
                  {act.work_item_title && <span className="font-medium">{act.work_item_title}</span>}
                </div>
                {act.field && (
                  <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                    <span className="font-mono bg-[var(--bg-surface-hover)] px-1 rounded">{act.field}</span>
                    <span>changed from</span>
                    <span className="font-medium">{act.old_value || 'None'}</span>
                    <span>to</span>
                    <span className="font-medium">{act.new_value || 'None'}</span>
                  </div>
                )}
                {act.created_at && (
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    {format(new Date(act.created_at), 'MMM d, yyyy h:mm a')}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[var(--text-secondary)] pb-4">No recent activity.</div>
        )}
      </div>
    </div>
  );
}
