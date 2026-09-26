'use client';

import React from 'react';
import { AnalyticsQueryParams } from '../api/analyticsApi';
import { useBlocked } from '../hooks/useAnalytics';
import { ChartCard } from './ChartCard';
import { AccessibleTable, Column } from './AccessibleTable';
import { BlockedWorkItemDto } from '@/shared/types/analytics';

interface BlockedReportViewProps {
  projectId: string;
  queryParams: AnalyticsQueryParams;
  onSelectWorkItem?: (itemId: string) => void;
}

export function BlockedReportView({ projectId, queryParams, onSelectWorkItem }: BlockedReportViewProps) {
  const blocked = useBlocked(projectId, queryParams);

  if (blocked.isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-28 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
        <div className="h-64 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
      </div>
    );
  }

  if (blocked.isError || !blocked.data) {
    return (
      <div className="p-8 text-center rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <p className="text-sm font-medium text-[var(--text-danger)]">Failed to load blocked work items report.</p>
        <button
          onClick={() => blocked.refetch()}
          className="mt-3 px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-surface-hover)]"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = blocked.data;
  const items = data.items || [];

  const columns: Column<BlockedWorkItemDto>[] = [
    { key: 'id', header: 'ID / Key', accessor: (r) => <span className="font-mono text-xs text-[var(--brand-primary)] font-semibold">{r.id.slice(0, 8)}</span>, sortable: true, sortValue: (r) => r.id },
    { key: 'title', header: 'Work Item Title', accessor: (r) => <span className="font-medium text-[var(--text-primary)]">{r.title}</span>, sortable: true, sortValue: (r) => r.title },
    { key: 'type', header: 'Type', accessor: (r) => <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] capitalize">{r.type}</span>, sortable: true, sortValue: (r) => r.type },
    { key: 'priority', header: 'Priority', accessor: (r) => <span className="text-xs font-medium">{r.priority}</span>, sortable: true, sortValue: (r) => r.priority },
    { key: 'state', header: 'State', accessor: (r) => <span className="text-xs font-medium">{r.state}</span>, sortable: true, sortValue: (r) => r.state },
    { key: 'assignee', header: 'Assignee', accessor: (r) => <span className="text-xs">{r.assigneeName || 'Unassigned'}</span>, sortable: true, sortValue: (r) => r.assigneeName || '' },
    {
      key: 'blockedReason',
      header: 'Blocker Reason / Dependency',
      accessor: (r) => (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" aria-hidden />
          <span>{r.blockedReason || 'Blocked by unresolved dependency'}</span>
        </div>
      ),
      sortable: true,
      sortValue: (r) => r.blockedReason || '',
    },
    {
      key: 'blockerItemId',
      header: 'Blocker Key',
      accessor: (r) =>
        r.blockerItemId ? (
          <span className="font-mono text-xs text-rose-600 underline cursor-pointer" onClick={(e) => { e.stopPropagation(); onSelectWorkItem?.(r.blockerItemId!); }}>
            {r.blockerItemId.slice(0, 8)}
          </span>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Blocked Summary Card */}
      <div className="p-4 rounded-[var(--radius-card)] border border-rose-500/30 bg-rose-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300">Blocked Work Items Summary</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Work items currently blocked by incomplete dependency work items or critical blocker tags.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-2xl font-bold tabular-nums text-rose-600">{data.blockedCount}</span>
          <span className="block text-[11px] text-[var(--text-muted)]">Blocked Items</span>
        </div>
      </div>

      {/* Blocked Items Accessible Table */}
      <ChartCard title="Blocked Work Items List" subtitle={`All ${items.length} blocked items requiring resolution`} meta={data.meta}>
        <AccessibleTable
          columns={columns}
          data={items}
          keyExtractor={(r) => r.id}
          pageSize={10}
          onRowClick={(row) => onSelectWorkItem?.(row.id)}
          emptyMessage="No blocked work items found matching current filters."
        />
      </ChartCard>
    </div>
  );
}
