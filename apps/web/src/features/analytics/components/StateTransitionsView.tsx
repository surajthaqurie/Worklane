'use client';

import React from 'react';
import { AnalyticsQueryParams } from '../api/analyticsApi';
import { useStateTransitions } from '../hooks/useAnalytics';
import { ChartCard } from './ChartCard';
import { AccessibleTable, Column } from './AccessibleTable';
import { StateTimeMetricDto } from '@/shared/types/analytics';
import { formatHoursCompact } from '../charts/model';

interface StateTransitionsViewProps {
  projectId: string;
  queryParams: AnalyticsQueryParams;
}

export function StateTransitionsView({ projectId, queryParams }: StateTransitionsViewProps) {
  const transitions = useStateTransitions(projectId, queryParams);

  if (transitions.isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
          ))}
        </div>
        <div className="h-64 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
      </div>
    );
  }

  if (transitions.isError || !transitions.data) {
    return (
      <div className="p-8 text-center rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <p className="text-sm font-medium text-[var(--text-danger)]">Failed to load state transitions report.</p>
        <button
          onClick={() => transitions.refetch()}
          className="mt-3 px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-surface-hover)]"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = transitions.data;
  const states = data.states || [];

  const columns: Column<StateTimeMetricDto>[] = [
    { key: 'stateName', header: 'Workflow State', accessor: (r) => <span className="font-semibold text-[var(--text-primary)]">{r.stateName}</span>, sortable: true, sortValue: (r) => r.stateName },
    { key: 'category', header: 'Category', accessor: (r) => <span className="text-xs text-[var(--text-muted)] capitalize">{r.category}</span>, sortable: true, sortValue: (r) => r.category },
    { key: 'itemCount', header: 'Items Dwell Count', accessor: (r) => <span className="tabular-nums font-medium">{r.itemCount}</span>, sortable: true, sortValue: (r) => r.itemCount },
    { key: 'avgHours', header: 'Avg Duration in State', accessor: (r) => <span className="tabular-nums font-medium">{formatHoursCompact(r.avgHours)}</span>, sortable: true, sortValue: (r) => r.avgHours },
    { key: 'medianHours', header: 'Median Duration (P50)', accessor: (r) => <span className="tabular-nums font-semibold text-blue-600">{formatHoursCompact(r.medianHours)}</span>, sortable: true, sortValue: (r) => r.medianHours },
    { key: 'p85Hours', header: 'P85 Duration', accessor: (r) => <span className="tabular-nums text-amber-600 font-medium">{formatHoursCompact(r.p85Hours)}</span>, sortable: true, sortValue: (r) => r.p85Hours },
    {
      key: 'isBottleneck',
      header: 'Bottleneck Status',
      accessor: (r) =>
        r.isBottleneck ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            Bottleneck State
          </span>
        ) : (
          <span className="text-xs text-emerald-600">Optimal flow</span>
        ),
      sortable: true,
      sortValue: (r) => (r.isBottleneck ? 1 : 0),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* State Transitions Overview Header */}
      <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Time in State &amp; Workflow Dwell Analysis</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Identifies workflow bottlenecks by calculating exact time spent by work items in each board state.
          </p>
        </div>
        <div className="flex gap-4 shrink-0">
          <div className="text-right">
            <span className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{states.length}</span>
            <span className="block text-[11px] text-[var(--text-muted)]">Active States</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold tabular-nums text-amber-600">
              {states.filter((s) => s.isBottleneck).length}
            </span>
            <span className="block text-[11px] text-[var(--text-muted)]">Bottleneck States</span>
          </div>
        </div>
      </div>

      {/* State Dwell Time Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {states.map((s) => (
          <div
            key={s.stateName}
            className={`p-4 rounded-[var(--radius-card)] border bg-[var(--bg-surface)] ${
              s.isBottleneck ? 'border-amber-500/40 bg-amber-500/5' : 'border-[var(--border-subtle)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-[var(--text-primary)]">{s.stateName}</span>
              {s.isBottleneck && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  BOTTLENECK
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-[var(--bg-surface-raised)]">
                <span className="block text-[10px] text-[var(--text-muted)] uppercase">Median</span>
                <span className="font-bold text-[var(--text-primary)]">{formatHoursCompact(s.medianHours)}</span>
              </div>
              <div className="p-2 rounded bg-[var(--bg-surface-raised)]">
                <span className="block text-[10px] text-[var(--text-muted)] uppercase">P85</span>
                <span className="font-bold text-amber-600">{formatHoursCompact(s.p85Hours)}</span>
              </div>
              <div className="p-2 rounded bg-[var(--bg-surface-raised)]">
                <span className="block text-[10px] text-[var(--text-muted)] uppercase">Items</span>
                <span className="font-bold text-[var(--text-primary)]">{s.itemCount}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dwell Time Accessible Table */}
      <ChartCard title="State Dwell Time Matrix" subtitle="Detailed breakdown of item dwell durations per state" meta={data.meta}>
        <AccessibleTable
          columns={columns}
          data={states}
          keyExtractor={(r) => r.stateName}
          pageSize={10}
        />
      </ChartCard>
    </div>
  );
}
