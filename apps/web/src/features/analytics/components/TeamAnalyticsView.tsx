'use client';

import React from 'react';
import { AnalyticsQueryParams } from '../api/analyticsApi';
import { useTeamAnalytics } from '../hooks/useAnalytics';
import { ChartCard } from './ChartCard';
import { AccessibleTable, Column } from './AccessibleTable';
import { TeamMemberPerformance } from '@/shared/types/analytics';

interface TeamAnalyticsViewProps {
  projectId: string;
  queryParams: AnalyticsQueryParams;
}

export function TeamAnalyticsView({ projectId, queryParams }: TeamAnalyticsViewProps) {
  const teamData = useTeamAnalytics(projectId, queryParams);

  if (teamData.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-48 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
        ))}
      </div>
    );
  }

  if (teamData.isError || !teamData.data) {
    return (
      <div className="p-8 text-center rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <p className="text-sm font-medium text-[var(--text-danger)]">Failed to load team analytics report.</p>
        <button
          onClick={() => teamData.refetch()}
          className="mt-3 px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-surface-hover)]"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = teamData.data;

  const memberColumns: Column<TeamMemberPerformance>[] = [
    {
      key: 'memberName',
      header: 'Assignee / Team Member',
      accessor: (r) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center font-semibold text-xs shrink-0">
            {r.memberName.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-[var(--text-primary)]">{r.memberName}</span>
        </div>
      ),
      sortable: true,
      sortValue: (r) => r.memberName,
    },
    { key: 'assignedCount', header: 'Assigned Work', accessor: (r) => <span className="tabular-nums">{r.assignedCount}</span>, sortable: true, sortValue: (r) => r.assignedCount },
    { key: 'inProgressCount', header: 'Work In Progress', accessor: (r) => <span className="tabular-nums text-blue-600 font-medium">{r.inProgressCount}</span>, sortable: true, sortValue: (r) => r.inProgressCount },
    { key: 'completedCount', header: 'Completed Work', accessor: (r) => <span className="tabular-nums text-emerald-600 font-medium">{r.completedCount}</span>, sortable: true, sortValue: (r) => r.completedCount },
    { key: 'completedPoints', header: 'Completed Points', accessor: (r) => <span className="tabular-nums font-semibold">{r.completedPoints} pts</span>, sortable: true, sortValue: (r) => r.completedPoints },
    { key: 'overdueCount', header: 'Overdue Items', accessor: (r) => <span className={`tabular-nums ${r.overdueCount > 0 ? 'text-amber-600 font-medium' : 'text-[var(--text-muted)]'}`}>{r.overdueCount}</span>, sortable: true, sortValue: (r) => r.overdueCount },
  ];

  const genericBreakdownColumns: Column<{ name: string; count: number; completed: number }>[] = [
    { key: 'name', header: 'Category', accessor: (r) => <span className="font-medium">{r.name}</span>, sortable: true, sortValue: (r) => r.name },
    { key: 'count', header: 'Assigned Items', accessor: (r) => <span className="tabular-nums">{r.count}</span>, sortable: true, sortValue: (r) => r.count },
    { key: 'completed', header: 'Completed', accessor: (r) => <span className="tabular-nums text-emerald-600">{r.completed}</span>, sortable: true, sortValue: (r) => r.completed },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Team Summary Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-label="Team Workload Summary">
        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <span className="text-[11px] font-medium uppercase text-[var(--text-muted)]">Total Team Work</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">{data.summary.totalWork}</div>
          <span className="text-xs text-[var(--text-muted)]">Active scope items</span>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <span className="text-[11px] font-medium uppercase text-[var(--text-muted)]">Completed Work</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">{data.summary.completed}</div>
          <span className="text-xs text-emerald-600/80">{data.summary.totalWork > 0 ? `${Math.round((data.summary.completed / data.summary.totalWork) * 100)}% complete` : '0%'}</span>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <span className="text-[11px] font-medium uppercase text-[var(--text-muted)]">Remaining Work</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-blue-600">{data.summary.remaining}</div>
          <span className="text-xs text-blue-600/80">In progress / backlog</span>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <span className="text-[11px] font-medium uppercase text-[var(--text-muted)]">Attention Needed</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-amber-600">{data.summary.overdue + data.summary.blocked}</div>
          <span className="text-xs text-amber-600">{data.summary.overdue} overdue, {data.summary.blocked} blocked</span>
        </div>
      </section>

      {/* Member Workload Table */}
      <ChartCard title="Team Operational Workload & Progress" subtitle="Work items, progress status, and completed points by assigned team member" meta={data.meta}>
        <AccessibleTable
          columns={memberColumns}
          data={data.byMember}
          keyExtractor={(r) => r.memberId}
          pageSize={10}
        />
      </ChartCard>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Team Work by Item Type" subtitle="Distribution of stories, bugs, tasks, and features" meta={data.meta}>
          <AccessibleTable
            columns={genericBreakdownColumns}
            data={data.byType}
            keyExtractor={(r) => r.name}
            pageSize={5}
          />
        </ChartCard>

        <ChartCard title="Team Work by Priority" subtitle="High, Medium, and Low priority item distribution" meta={data.meta}>
          <AccessibleTable
            columns={genericBreakdownColumns}
            data={data.byPriority}
            keyExtractor={(r) => r.name}
            pageSize={5}
          />
        </ChartCard>
      </div>
    </div>
  );
}
