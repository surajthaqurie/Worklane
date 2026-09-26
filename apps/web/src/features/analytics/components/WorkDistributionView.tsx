'use client';

import React, { useState } from 'react';
import { AnalyticsQueryParams } from '../api/analyticsApi';
import { useWorkDistribution } from '../hooks/useAnalytics';
import { ChartCard } from './ChartCard';
import { AccessibleTable, Column } from './AccessibleTable';

interface WorkDistributionViewProps {
  projectId: string;
  queryParams: AnalyticsQueryParams;
}

export function WorkDistributionView({ projectId, queryParams }: WorkDistributionViewProps) {
  const [activeDimension, setActiveDimension] = useState<'type' | 'state' | 'priority' | 'area' | 'assignee'>('type');
  const distribution = useWorkDistribution(projectId, queryParams);

  if (distribution.isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-48 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
        <div className="h-64 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
      </div>
    );
  }

  if (distribution.isError || !distribution.data) {
    return (
      <div className="p-8 text-center rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <p className="text-sm font-medium text-[var(--text-danger)]">Failed to load work distribution report.</p>
        <button
          onClick={() => distribution.refetch()}
          className="mt-3 px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-surface-hover)]"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = distribution.data;

  const getDimensionData = () => {
    switch (activeDimension) {
      case 'type':
        return { title: 'Work Item Types', data: data.byType };
      case 'state':
        return { title: 'Workflow States', data: data.byState };
      case 'priority':
        return { title: 'Item Priorities', data: data.byPriority };
      case 'area':
        return { title: 'Area Paths', data: data.byArea };
      case 'assignee':
        return { title: 'Team Assignees', data: data.byAssignee };
    }
  };

  const current = getDimensionData();

  const columns: Column<{ name: string; count: number; completed: number; percentage: number }>[] = [
    { key: 'name', header: 'Category Name', accessor: (r) => <span className="font-medium text-[var(--text-primary)]">{r.name}</span>, sortable: true, sortValue: (r) => r.name },
    { key: 'count', header: 'Item Count', accessor: (r) => <span className="tabular-nums font-semibold">{r.count}</span>, sortable: true, sortValue: (r) => r.count },
    { key: 'completed', header: 'Completed Items', accessor: (r) => <span className="tabular-nums text-emerald-600">{r.completed}</span>, sortable: true, sortValue: (r) => r.completed },
    {
      key: 'percentage',
      header: 'Share of Scope',
      accessor: (r) => (
        <div className="flex items-center gap-2">
          <div className="w-20 bg-[var(--bg-surface-raised)] rounded-full h-2 overflow-hidden">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${r.percentage}%` }} />
          </div>
          <span className="tabular-nums text-xs font-medium">{r.percentage}%</span>
        </div>
      ),
      sortable: true,
      sortValue: (r) => r.percentage,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Dimension Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-surface)] p-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)]">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Work Item Distribution</h3>
          <p className="text-xs text-[var(--text-muted)]">Breakdown across types, states, priorities, areas, and assignees</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-[var(--radius-button)] border border-[var(--border-subtle)] p-0.5 text-xs font-medium">
          {(['type', 'state', 'priority', 'area', 'assignee'] as const).map((dim) => (
            <button
              key={dim}
              onClick={() => setActiveDimension(dim)}
              className={`px-3 py-1 rounded capitalize transition-colors ${
                activeDimension === dim ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {dim}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Breakdown Cards */}
      <ChartCard title={`Distribution by ${current.title}`} subtitle={`Work item count and completion breakdown by ${activeDimension}`} meta={data.meta}>
        <div className="space-y-4 py-2">
          {current.data.map((item) => (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--text-primary)]">{item.name}</span>
                <span className="text-[var(--text-muted)] tabular-nums">
                  {item.count} items ({item.percentage}%) · <span className="text-emerald-600">{item.completed} done</span>
                </span>
              </div>
              <div className="w-full bg-[var(--bg-surface-raised)] rounded-full h-2.5 overflow-hidden">
                <div className="bg-blue-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${item.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* Accessible Table */}
      <ChartCard title={`${current.title} Data Table`} subtitle={`Structured table representation for ${activeDimension} distribution`} meta={data.meta}>
        <AccessibleTable
          columns={columns}
          data={current.data}
          keyExtractor={(r) => r.name}
          pageSize={10}
        />
      </ChartCard>
    </div>
  );
}
