'use client';

import React from 'react';
import { AnalyticsQueryParams } from '../api/analyticsApi';
import { useOverdue } from '../hooks/useAnalytics';
import { ChartCard } from './ChartCard';
import { AccessibleTable, Column } from './AccessibleTable';
import { OverdueWorkItemDto } from '@/shared/types/analytics';

interface OverdueReportViewProps {
  projectId: string;
  queryParams: AnalyticsQueryParams;
  onSelectWorkItem?: (itemId: string) => void;
}

export function OverdueReportView({ projectId, queryParams, onSelectWorkItem }: OverdueReportViewProps) {
  const overdue = useOverdue(projectId, queryParams);

  if (overdue.isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-28 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
        <div className="h-64 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
      </div>
    );
  }

  if (overdue.isError || !overdue.data) {
    return (
      <div className="p-8 text-center rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <p className="text-sm font-medium text-[var(--text-danger)]">Failed to load overdue work items report.</p>
        <button
          onClick={() => overdue.refetch()}
          className="mt-3 px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-surface-hover)]"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = overdue.data;
  const items = data.items || [];

  const columns: Column<OverdueWorkItemDto>[] = [
    { key: 'id', header: 'ID / Key', accessor: (r) => <span className="font-mono text-xs text-[var(--brand-primary)] font-semibold">{r.id.slice(0, 8)}</span>, sortable: true, sortValue: (r) => r.id },
    { key: 'title', header: 'Work Item Title', accessor: (r) => <span className="font-medium text-[var(--text-primary)]">{r.title}</span>, sortable: true, sortValue: (r) => r.title },
    { key: 'type', header: 'Type', accessor: (r) => <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] capitalize">{r.type}</span>, sortable: true, sortValue: (r) => r.type },
    { key: 'priority', header: 'Priority', accessor: (r) => <span className="text-xs font-medium">{r.priority}</span>, sortable: true, sortValue: (r) => r.priority },
    { key: 'state', header: 'State', accessor: (r) => <span className="text-xs font-medium">{r.state}</span>, sortable: true, sortValue: (r) => r.state },
    { key: 'assignee', header: 'Assignee', accessor: (r) => <span className="text-xs">{r.assigneeName || 'Unassigned'}</span>, sortable: true, sortValue: (r) => r.assigneeName || '' },
    { key: 'iteration', header: 'Iteration', accessor: (r) => <span className="text-xs text-[var(--text-muted)]">{r.iterationName || 'Backlog'}</span>, sortable: true, sortValue: (r) => r.iterationName || '' },
    { key: 'dueDate', header: 'Due Date', accessor: (r) => <span className="text-xs text-[var(--text-muted)]">{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : 'N/A'}</span>, sortable: true, sortValue: (r) => (r.dueDate ? new Date(r.dueDate).getTime() : 0) },
    {
      key: 'daysOverdue',
      header: 'Days Overdue',
      accessor: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
          +{r.daysOverdue} days
        </span>
      ),
      sortable: true,
      sortValue: (r) => r.daysOverdue,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Overdue Summary Card */}
      <div className="p-4 rounded-[var(--radius-card)] border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">Overdue Work Items Summary</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Work items past their target due date that remain open or in progress.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-2xl font-bold tabular-nums text-amber-600">{data.overdueCount}</span>
          <span className="block text-[11px] text-[var(--text-muted)]">Overdue Items</span>
        </div>
      </div>

      {/* Overdue Items Accessible Table */}
      <ChartCard title="Overdue Work Items List" subtitle={`All ${items.length} overdue items sorted by urgency`} meta={data.meta}>
        <AccessibleTable
          columns={columns}
          data={items}
          keyExtractor={(r) => r.id}
          pageSize={10}
          onRowClick={(row) => onSelectWorkItem?.(row.id)}
          emptyMessage="No overdue work items found matching current filters."
        />
      </ChartCard>
    </div>
  );
}
