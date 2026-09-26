'use client';

import React from 'react';
import { AnalyticsQueryParams } from '../api/analyticsApi';
import { useProjectHealth } from '../hooks/useAnalytics';
import { ChartCard } from './ChartCard';
import { AccessibleTable, Column } from './AccessibleTable';

interface ProjectHealthViewProps {
  projectId: string;
  queryParams: AnalyticsQueryParams;
}

export function ProjectHealthView({ projectId, queryParams }: ProjectHealthViewProps) {
  const health = useProjectHealth(projectId, queryParams);

  if (health.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-48 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
        ))}
      </div>
    );
  }

  if (health.isError || !health.data) {
    return (
      <div className="p-8 text-center rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <p className="text-sm font-medium text-[var(--text-danger)]">Failed to load project health report.</p>
        <button
          onClick={() => health.refetch()}
          className="mt-3 px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-surface-hover)]"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = health.data;

  // Breakdown Columns
  const breakdownColumns: Column<{ name: string; count: number; completed: number } >[] = [
    { key: 'name', header: 'Category / Name', accessor: (r) => <span className="font-medium">{r.name}</span>, sortable: true, sortValue: (r) => r.name },
    { key: 'count', header: 'Total Work Items', accessor: (r) => <span className="tabular-nums">{r.count}</span>, sortable: true, sortValue: (r) => r.count },
    { key: 'completed', header: 'Completed', accessor: (r) => <span className="tabular-nums text-emerald-600 font-medium">{r.completed}</span>, sortable: true, sortValue: (r) => r.completed },
    {
      key: 'rate',
      header: 'Completion Rate',
      accessor: (r) => {
        const pct = r.count > 0 ? Math.round((r.completed / r.count) * 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 bg-[var(--bg-surface-raised)] rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="tabular-nums text-xs">{pct}%</span>
          </div>
        );
      },
      sortable: true,
      sortValue: (r) => (r.count > 0 ? (r.completed / r.count) * 100 : 0),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Health Overview Summary Cards */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" aria-label="Project Health Summary">
        <HealthMetricCard label="Total Items" value={data.progress.total} subtext="In project scope" />
        <HealthMetricCard label="Completed" value={data.progress.completed} subtext={`${data.progress.completionPercent}% done`} color="text-emerald-500" />
        <HealthMetricCard label="In Progress" value={data.progress.inProgress} subtext="Active work" color="text-blue-500" />
        <HealthMetricCard label="Not Started" value={data.progress.notStarted} subtext="Backlog items" color="text-gray-400" />
        <HealthMetricCard label="Blocked" value={data.progress.blocked} subtext="Dependencies" color="text-rose-500" />
        <HealthMetricCard label="Overdue" value={data.progress.overdue} subtext="Past due date" color="text-amber-500" />
      </section>

      {/* Progress Bar Container */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-[var(--text-primary)]">Overall Completion Rate</span>
          <span className="text-emerald-600 font-semibold">{data.progress.completionPercent}% Completed ({data.progress.completed}/{data.progress.total})</span>
        </div>
        <div className="w-full bg-[var(--bg-surface-raised)] rounded-full h-3 flex overflow-hidden">
          <div className="bg-emerald-500 h-full" style={{ width: `${data.progress.completionPercent}%` }} title="Completed" />
          <div
            className="bg-blue-500 h-full"
            style={{ width: `${data.progress.total > 0 ? (data.progress.inProgress / data.progress.total) * 100 : 0}%` }}
            title="In Progress"
          />
          <div
            className="bg-amber-500 h-full"
            style={{ width: `${data.progress.total > 0 ? (data.progress.overdue / data.progress.total) * 100 : 0}%` }}
            title="Overdue"
          />
        </div>
      </div>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Work by Priority" subtitle="Distribution and completion across priorities" meta={data.meta}>
          <AccessibleTable
            columns={breakdownColumns}
            data={data.byPriority}
            keyExtractor={(r) => r.name}
            pageSize={5}
          />
        </ChartCard>

        <ChartCard title="Work by Type" subtitle="Distribution across work item types" meta={data.meta}>
          <AccessibleTable
            columns={breakdownColumns}
            data={data.byType}
            keyExtractor={(r) => r.name}
            pageSize={5}
          />
        </ChartCard>

        <ChartCard title="Work by Area" subtitle="Distribution across area paths" meta={data.meta}>
          <AccessibleTable
            columns={breakdownColumns}
            data={data.byArea}
            keyExtractor={(r) => r.name}
            pageSize={5}
          />
        </ChartCard>

        <ChartCard title="Work by Iteration" subtitle="Distribution across iterations" meta={data.meta}>
          <AccessibleTable
            columns={breakdownColumns}
            data={data.byIteration}
            keyExtractor={(r) => r.name}
            pageSize={5}
          />
        </ChartCard>
      </div>
    </div>
  );
}

function HealthMetricCard({ label, value, subtext, color = 'text-[var(--text-primary)]' }: { label: string; value: number; subtext: string; color?: string }) {
  return (
    <div className="p-3.5 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{subtext}</p>
    </div>
  );
}
