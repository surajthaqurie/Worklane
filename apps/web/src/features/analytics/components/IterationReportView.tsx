'use client';

import React from 'react';
import { useBurndown, useIterationReport } from '../hooks/useAnalytics';
import { SprintBurndownChart } from './SprintBurndownChart';
import { AccessibleTable, Column } from './AccessibleTable';
import { ChartCard } from './ChartCard';

interface IterationReportViewProps {
  projectId: string;
  iterationId: string | undefined;
  teamId?: string | null;
  iterations?: Array<{ id: string; name: string }>;
  onSelectIteration?: (id: string) => void;
}

export function IterationReportView({
  projectId,
  iterationId,
  teamId,
  iterations,
  onSelectIteration,
}: IterationReportViewProps) {
  const iterationReport = useIterationReport(projectId, iterationId, teamId);
  const burndown = useBurndown(projectId, iterationId, teamId);

  if (!iterationId) {
    return (
      <div className="p-8 text-center rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <p className="text-sm font-medium text-[var(--text-muted)]">No active or selected iteration found.</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Select an iteration from the filter bar to view iteration report metrics.</p>
      </div>
    );
  }

  if (iterationReport.isLoading || burndown.isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-24 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
          ))}
        </div>
        <div className="h-72 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
      </div>
    );
  }

  const report = iterationReport.data;

  const itemColumns: Column<{ id: string; title: string; type: string; state: string; points: number; assignee: string }>[] = [
    { key: 'id', header: 'ID / Key', accessor: (r) => <span className="font-mono text-xs">{r.id.slice(0, 8)}</span>, sortable: true, sortValue: (r) => r.id },
    { key: 'title', header: 'Work Item Title', accessor: (r) => <span className="font-medium text-[var(--text-primary)]">{r.title}</span>, sortable: true, sortValue: (r) => r.title },
    { key: 'type', header: 'Type', accessor: (r) => <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] capitalize">{r.type}</span>, sortable: true, sortValue: (r) => r.type },
    { key: 'state', header: 'State', accessor: (r) => <span className="text-xs font-medium">{r.state}</span>, sortable: true, sortValue: (r) => r.state },
    { key: 'assignee', header: 'Assignee', accessor: (r) => <span className="text-xs">{r.assignee || 'Unassigned'}</span>, sortable: true, sortValue: (r) => r.assignee || '' },
    { key: 'points', header: 'Story Points', accessor: (r) => <span className="tabular-nums font-semibold">{r.points ?? 0} pts</span>, sortable: true, sortValue: (r) => r.points ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Iteration Progress Summary Cards */}
      {report && (
        <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3" aria-label="Iteration Metrics">
          <StatCard label="Committed" value={`${report.committedItems} (${report.committedPoints} pts)`} hint="Original scope" />
          <StatCard label="Completed" value={`${report.completedItems} (${report.completedPoints} pts)`} hint={`${report.completionPercent}% done`} color="text-emerald-500" />
          <StatCard label="Remaining" value={`${report.remainingItems} (${report.remainingPoints} pts)`} hint="Remaining work" color="text-blue-500" />
          <StatCard label="Added After Start" value={`+${report.addedAfterStartItems}`} hint={`+${report.addedAfterStartPoints} pts`} color="text-purple-500" />
          <StatCard label="Removed Scope" value={`-${report.removedItems}`} hint={`-${report.removedPoints} pts`} color="text-gray-400" />
          <StatCard label="Blocked" value={String(report.blockedItems)} hint="Dependencies" color="text-rose-500" />
          <StatCard label="Overdue" value={String(report.overdueItems)} hint="Past due date" color="text-amber-500" />
        </section>
      )}

      {/* Burndown Chart */}
      <SprintBurndownChart
        data={burndown.data}
        isLoading={burndown.isLoading}
        error={burndown.error}
        onRetry={() => burndown.refetch()}
        iterations={iterations}
        selectedIterationId={iterationId}
        onSelectIteration={onSelectIteration}
      />

      {/* Iteration Items Data Table */}
      {report && (
        <ChartCard title="Iteration Work Items" subtitle={`All ${report.items.length} items scoped to ${report.iterationName}`} meta={report.meta}>
          <AccessibleTable
            columns={itemColumns}
            data={report.items}
            keyExtractor={(r) => r.id}
            pageSize={10}
          />
        </ChartCard>
      )}
    </div>
  );
}

function StatCard({ label, value, hint, color = 'text-[var(--text-primary)]' }: { label: string; value: string; hint: string; color?: string }) {
  return (
    <div className="p-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      <div className={`mt-1 text-lg font-bold tabular-nums truncate ${color}`}>{value}</div>
      <p className="mt-0.5 text-[11px] text-[var(--text-muted)] truncate">{hint}</p>
    </div>
  );
}
