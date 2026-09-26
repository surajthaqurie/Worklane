'use client';

import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Ban,
  Layers,
  TrendingUp,
  Activity,
  BarChart3,
} from 'lucide-react';
import { AnalyticsQueryParams } from '../api/analyticsApi';
import { useAnalyticsSummary } from '../hooks/useAnalytics';
import { ChartCard } from './ChartCard';
import { AccessibleTable, Column } from './AccessibleTable';
import { formatHoursCompact } from '../charts/model';

interface OverviewReportViewProps {
  projectId: string;
  queryParams: AnalyticsQueryParams;
  onNavigateTab?: (tab: string) => void;
}

export function OverviewReportView({ projectId, queryParams, onNavigateTab }: OverviewReportViewProps) {
  const summary = useAnalyticsSummary(projectId, queryParams);

  if (summary.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-28 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
        ))}
      </div>
    );
  }

  if (summary.isError || !summary.data) {
    return (
      <div className="p-8 text-center rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <p className="text-sm font-medium text-[var(--text-danger)]">Failed to load overview metrics.</p>
        <button
          onClick={() => summary.refetch()}
          className="mt-3 px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-surface-hover)]"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = summary.data;
  const completionRate = data.totalItems > 0 ? Math.round((data.completedCount / data.totalItems) * 100) : 0;

  const flowTableColumns: Column<{ state: string; count: number; category: string }>[] = [
    { key: 'category', header: 'Flow State Category', accessor: (r) => <span className="capitalize font-medium">{r.category}</span>, sortable: true, sortValue: (r) => r.category },
    { key: 'count', header: 'Work Items Count', accessor: (r) => <span className="tabular-nums">{r.count}</span>, sortable: true, sortValue: (r) => r.count },
    { key: 'percent', header: 'Percentage of Total', accessor: (r) => <span className="tabular-nums">{data.totalItems > 0 ? `${Math.round((r.count / data.totalItems) * 100)}%` : '0%'}</span> },
  ];

  const flowTableData = [
    { state: 'Proposed', category: 'Proposed / Backlog', count: data.flow.proposed },
    { state: 'In Progress', category: 'Active / In Progress', count: data.flow.inProgress },
    { state: 'Resolved', category: 'Resolved / Verification', count: data.flow.resolved },
    { state: 'Completed', category: 'Completed / Closed', count: data.flow.completed },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Cards Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Executive KPI Cards">
        <KpiCard
          icon={<Layers className="w-5 h-5 text-blue-500" />}
          label="Total Work Items"
          value={String(data.totalItems)}
          definition="All work items matching current scope & filters"
          badge={`${data.openCount} open`}
          onClick={() => onNavigateTab?.('work-items')}
        />

        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          label="Completion Rate"
          value={`${completionRate}%`}
          definition={`${data.completedCount} completed of ${data.totalItems} total`}
          badge={`${data.completedInRange} completed in range`}
          onClick={() => onNavigateTab?.('project-health')}
        />

        <KpiCard
          icon={<Clock className="w-5 h-5 text-indigo-500" />}
          label="Avg Cycle Time"
          value={formatHoursCompact(data.cycleTime.medianHours)}
          definition="Median elapsed time from Started → Completed"
          badge={`${data.cycleTime.count} completed items`}
          onClick={() => onNavigateTab?.('cycle-time')}
        />

        <KpiCard
          icon={<TrendingUp className="w-5 h-5 text-amber-500" />}
          label="Avg Velocity"
          value={`${data.velocity.avgCompletedPoints} pts`}
          definition="Average completed story points per sprint"
          badge={`${data.velocity.iterations} sprints analyzed`}
          onClick={() => onNavigateTab?.('velocity')}
        />

        <KpiCard
          icon={<Activity className="w-5 h-5 text-cyan-500" />}
          label="Throughput"
          value={`${data.throughput.totalCompleted} items`}
          definition="Work items closed during current filter range"
          badge={`~${data.throughput.avgPerWeek}/wk avg`}
          onClick={() => onNavigateTab?.('throughput')}
        />

        <KpiCard
          icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
          label="Overdue Items"
          value={String(data.overdueCount)}
          definition="Active work items past their scheduled due date"
          badge={data.overdueCount > 0 ? 'Requires attention' : 'On schedule'}
          alert={data.overdueCount > 0}
          onClick={() => onNavigateTab?.('overdue')}
        />

        <KpiCard
          icon={<Ban className="w-5 h-5 text-rose-500" />}
          label="Blocked Items"
          value={String(data.blockedCount)}
          definition="Work items blocked by dependencies or critical issues"
          badge={data.blockedCount > 0 ? 'Action required' : 'No blockers'}
          alert={data.blockedCount > 0}
          onClick={() => onNavigateTab?.('blocked')}
        />

        <KpiCard
          icon={<BarChart3 className="w-5 h-5 text-purple-500" />}
          label="Lead Time Median"
          value={formatHoursCompact(data.leadTime.medianHours)}
          definition="Median total lead time from Created → Completed"
          badge={`${data.leadTime.count} completed items`}
          onClick={() => onNavigateTab?.('cycle-time')}
        />
      </section>

      {/* Summary Charts & Flow Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Workflow Status Breakdown"
          subtitle="Distribution of work items across workflow categories"
          meta={data.meta}
        >
          <div className="space-y-4 py-2">
            {[
              { label: 'Proposed / Backlog', count: data.flow.proposed, color: 'bg-gray-400' },
              { label: 'Active / In Progress', count: data.flow.inProgress, color: 'bg-blue-500' },
              { label: 'Resolved / Testing', count: data.flow.resolved, color: 'bg-amber-500' },
              { label: 'Completed / Closed', count: data.flow.completed, color: 'bg-emerald-500' },
            ].map((item) => {
              const pct = data.totalItems > 0 ? Math.round((item.count / data.totalItems) * 100) : 0;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--text-primary)]">{item.label}</span>
                    <span className="text-[var(--text-muted)] tabular-nums">{item.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-[var(--bg-surface-raised)] rounded-full h-2.5 overflow-hidden">
                    <div className={`${item.color} h-2.5 rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>

        <AccessibleTable
          title="Workflow Distribution Data Table"
          caption="Detailed state category counts and percentages"
          columns={flowTableColumns}
          data={flowTableData}
          keyExtractor={(r) => r.state}
        />
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  definition,
  badge,
  alert,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  definition: string;
  badge?: string;
  alert?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex flex-col justify-between p-4 rounded-[var(--radius-card)] border bg-[var(--bg-surface)] transition-all ${
        onClick ? 'cursor-pointer hover:border-[var(--brand-primary)]/50 hover:shadow-xs' : ''
      } ${alert ? 'border-amber-500/40 bg-amber-500/5' : 'border-[var(--border-subtle)]'}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
            {icon}
            {label}
          </span>
          {badge && (
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                alert
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  : 'bg-[var(--bg-surface-raised)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
              }`}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="mt-2 text-2xl font-bold text-[var(--text-primary)] tabular-nums">{value}</div>
      </div>
      <p className="mt-2 text-[11px] text-[var(--text-muted)] line-clamp-1">{definition}</p>
    </div>
  );
}
