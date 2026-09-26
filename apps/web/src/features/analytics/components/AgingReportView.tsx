'use client';

import React, { useState } from 'react';
import { AnalyticsQueryParams } from '../api/analyticsApi';
import { useAging } from '../hooks/useAnalytics';
import { ChartCard } from './ChartCard';
import { AccessibleTable, Column } from './AccessibleTable';
import { WorkItemAgingItemDto } from '@/shared/types/analytics';

interface AgingReportViewProps {
  projectId: string;
  queryParams: AnalyticsQueryParams;
}

export function AgingReportView({ projectId, queryParams }: AgingReportViewProps) {
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const aging = useAging(projectId, queryParams);

  if (aging.isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
          ))}
        </div>
        <div className="h-64 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
      </div>
    );
  }

  if (aging.isError || !aging.data) {
    return (
      <div className="p-8 text-center rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <p className="text-sm font-medium text-[var(--text-danger)]">Failed to load work item aging report.</p>
        <button
          onClick={() => aging.refetch()}
          className="mt-3 px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-surface-hover)]"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = aging.data;
  const buckets = data.buckets || [];
  const items = data.items || [];

  const filteredItems = selectedBucket
    ? items.filter((item) => {
        if (selectedBucket === '0-3') return item.ageDays <= 3;
        if (selectedBucket === '4-7') return item.ageDays >= 4 && item.ageDays <= 7;
        if (selectedBucket === '8-14') return item.ageDays >= 8 && item.ageDays <= 14;
        if (selectedBucket === '15-30') return item.ageDays >= 15 && item.ageDays <= 30;
        if (selectedBucket === '30+') return item.ageDays > 30;
        return true;
      })
    : items;

  const columns: Column<WorkItemAgingItemDto>[] = [
    { key: 'id', header: 'ID / Key', accessor: (r) => <span className="font-mono text-xs">{r.id.slice(0, 8)}</span>, sortable: true, sortValue: (r) => r.id },
    { key: 'title', header: 'Work Item Title', accessor: (r) => <span className="font-medium text-[var(--text-primary)]">{r.title}</span>, sortable: true, sortValue: (r) => r.title },
    { key: 'type', header: 'Type', accessor: (r) => <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] capitalize">{r.type}</span>, sortable: true, sortValue: (r) => r.type },
    { key: 'state', header: 'State', accessor: (r) => <span className="text-xs font-medium">{r.state}</span>, sortable: true, sortValue: (r) => r.state },
    { key: 'priority', header: 'Priority', accessor: (r) => <span className="text-xs font-medium">{r.priority}</span>, sortable: true, sortValue: (r) => r.priority },
    { key: 'assignee', header: 'Assignee', accessor: (r) => <span className="text-xs">{r.assigneeName || 'Unassigned'}</span>, sortable: true, sortValue: (r) => r.assigneeName || '' },
    {
      key: 'ageDays',
      header: 'Total Age (Days)',
      accessor: (r) => (
        <span className={`tabular-nums font-semibold ${r.ageDays > 14 ? 'text-amber-600' : 'text-[var(--text-primary)]'}`}>
          {r.ageDays} days
        </span>
      ),
      sortable: true,
      sortValue: (r) => r.ageDays,
    },
    { key: 'daysInState', header: 'Days in Current State', accessor: (r) => <span className="tabular-nums text-xs text-[var(--text-muted)]">{r.daysInCurrentState} days</span>, sortable: true, sortValue: (r) => r.daysInCurrentState },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Bucket KPI Cards */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3" aria-label="Work Item Age Buckets">
        {buckets.map((b) => {
          const isSelected = selectedBucket === b.rangeKey;
          return (
            <div
              key={b.rangeKey}
              onClick={() => setSelectedBucket(isSelected ? null : b.rangeKey)}
              className={`p-4 rounded-[var(--radius-card)] border cursor-pointer transition-all ${
                isSelected
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 ring-2 ring-[var(--brand-primary)]/20'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span className="font-semibold uppercase tracking-wider">{b.label}</span>
                {isSelected && <span className="text-[10px] font-bold text-[var(--brand-primary)]">FILTERED</span>}
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-[var(--text-primary)]">{b.count}</div>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">{b.description || 'Active work items'}</p>
            </div>
          );
        })}
      </section>

      {/* Drill-Down Active Work Items Table */}
      <ChartCard
        title="Active Work Item Aging Drill-Down"
        subtitle={
          selectedBucket
            ? `Showing ${filteredItems.length} active items in age bucket "${selectedBucket}"`
            : `Showing all ${items.length} active items by open duration`
        }
        meta={data.meta}
        actions={
          selectedBucket ? (
            <button
              onClick={() => setSelectedBucket(null)}
              className="text-xs text-[var(--brand-primary)] hover:underline font-medium"
            >
              Clear Bucket Filter
            </button>
          ) : undefined
        }
      >
        <AccessibleTable
          columns={columns}
          data={filteredItems}
          keyExtractor={(r) => r.id}
          pageSize={10}
        />
      </ChartCard>
    </div>
  );
}
