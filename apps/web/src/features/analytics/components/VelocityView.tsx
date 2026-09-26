'use client';

import React, { useState } from 'react';
import { AnalyticsQueryParams } from '../api/analyticsApi';
import { useVelocity } from '../hooks/useAnalytics';
import { VelocityChart } from './VelocityChart';
import { AccessibleTable, Column } from './AccessibleTable';
import { VelocityIterationDto } from '@/shared/types/analytics';
import { ChartCard } from './ChartCard';

interface VelocityViewProps {
  projectId: string;
  queryParams: AnalyticsQueryParams;
}

export function VelocityView({ projectId, queryParams }: VelocityViewProps) {
  const [metric, setMetric] = useState<'points' | 'items'>('points');
  const velocity = useVelocity(projectId, queryParams);

  if (velocity.isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-28 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
        <div className="h-72 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
      </div>
    );
  }

  if (velocity.isError || !velocity.data) {
    return (
      <div className="p-8 text-center rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <p className="text-sm font-medium text-[var(--text-danger)]">Failed to load velocity analytics.</p>
        <button
          onClick={() => velocity.refetch()}
          className="mt-3 px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-surface-hover)]"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = velocity.data;

  const columns: Column<VelocityIterationDto>[] = [
    { key: 'name', header: 'Iteration / Sprint', accessor: (r) => <span className="font-medium text-[var(--text-primary)]">{r.name}</span>, sortable: true, sortValue: (r) => r.name },
    { key: 'dates', header: 'Sprint Window', accessor: (r) => <span className="text-xs text-[var(--text-muted)]">{r.startDate} → {r.endDate}</span> },
    { key: 'committedPoints', header: 'Committed Points', accessor: (r) => <span className="tabular-nums">{r.committedPoints} pts</span>, sortable: true, sortValue: (r) => r.committedPoints },
    { key: 'completedPoints', header: 'Completed Points', accessor: (r) => <span className="tabular-nums text-emerald-600 font-semibold">{r.completedPoints} pts</span>, sortable: true, sortValue: (r) => r.completedPoints },
    { key: 'committedItems', header: 'Committed Items', accessor: (r) => <span className="tabular-nums">{r.committedItems}</span>, sortable: true, sortValue: (r) => r.committedItems },
    { key: 'completedItems', header: 'Completed Items', accessor: (r) => <span className="tabular-nums text-blue-600 font-medium">{r.completedItems}</span>, sortable: true, sortValue: (r) => r.completedItems },
    {
      key: 'ratio',
      header: 'Completion Rate',
      accessor: (r) => {
        const pct = r.completionRatio !== null ? Math.round(r.completionRatio * 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 bg-[var(--bg-surface-raised)] rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <span className="tabular-nums text-xs">{pct}%</span>
          </div>
        );
      },
      sortable: true,
      sortValue: (r) => (r.completionRatio !== null ? r.completionRatio * 100 : 0),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Velocity KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-label="Velocity KPIs">
        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <span className="text-[11px] font-medium uppercase text-[var(--text-muted)]">Average Velocity</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">{data.summary.avgCompletedPoints} pts</div>
          <span className="text-xs text-[var(--text-muted)]">Completed story points per sprint</span>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <span className="text-[11px] font-medium uppercase text-[var(--text-muted)]">Last Sprint Velocity</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">{data.summary.lastCompletedPoints} pts</div>
          <span className="text-xs text-emerald-600/80">Completed in most recent sprint</span>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <span className="text-[11px] font-medium uppercase text-[var(--text-muted)]">Total Story Points</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-indigo-600">{data.summary.totalCompletedPoints} pts</div>
          <span className="text-xs text-indigo-600/80">Completed across all {data.summary.iterations} sprints</span>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <span className="text-[11px] font-medium uppercase text-[var(--text-muted)]">Avg Scope Commitment</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-gray-500">{data.summary.avgCommittedPoints} pts</div>
          <span className="text-xs text-[var(--text-muted)]">Committed points per sprint</span>
        </div>
      </section>

      {/* Velocity Chart */}
      <VelocityChart
        data={data}
        isLoading={velocity.isLoading}
        error={velocity.error}
        onRetry={() => velocity.refetch()}
        metric={metric}
        onMetricChange={setMetric}
      />

      {/* Velocity History Table */}
      <ChartCard title="Iteration Velocity History" subtitle="Detailed breakdown of committed vs completed points and items per iteration" meta={data.meta}>
        <AccessibleTable
          columns={columns}
          data={data.iterations}
          keyExtractor={(r) => r.iterationId}
          pageSize={10}
        />
      </ChartCard>
    </div>
  );
}
