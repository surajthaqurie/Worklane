'use client';

import React, { useState } from 'react';
import { AnalyticsQueryParams } from '../api/analyticsApi';
import { useThroughput } from '../hooks/useAnalytics';
import { ChartCard } from './ChartCard';
import { AccessibleTable, Column } from './AccessibleTable';
import { ThroughputPeriodDto } from '@/shared/types/analytics';
import { barHeight, barLayout, barY, makeArea, niceTicks } from '../charts/model';
import { ResponsiveChart, XLabels, YAxis } from './chartPrimitives';

interface ThroughputViewProps {
  projectId: string;
  queryParams: AnalyticsQueryParams;
}

export function ThroughputView({ projectId, queryParams }: ThroughputViewProps) {
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('week');
  const throughput = useThroughput(projectId, { ...queryParams, groupBy });

  if (throughput.isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-28 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
        <div className="h-72 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
      </div>
    );
  }

  if (throughput.isError || !throughput.data) {
    return (
      <div className="p-8 text-center rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <p className="text-sm font-medium text-[var(--text-danger)]">Failed to load throughput report.</p>
        <button
          onClick={() => throughput.refetch()}
          className="mt-3 px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-surface-hover)]"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = throughput.data;
  const periods = data.periods ?? [];
  const maxCount = Math.max(...periods.map((p) => p.completedItems), 1);
  const ticks = niceTicks(maxCount);

  const columns: Column<ThroughputPeriodDto>[] = [
    { key: 'label', header: 'Period', accessor: (r) => <span className="font-medium text-[var(--text-primary)]">{r.label}</span>, sortable: true, sortValue: (r) => r.label },
    { key: 'periodStart', header: 'Period Start', accessor: (r) => <span className="text-xs text-[var(--text-muted)]">{r.periodStart}</span>, sortable: true, sortValue: (r) => r.periodStart },
    { key: 'periodEnd', header: 'Period End', accessor: (r) => <span className="text-xs text-[var(--text-muted)]">{r.periodEnd}</span>, sortable: true, sortValue: (r) => r.periodEnd },
    { key: 'completedItems', header: 'Completed Work Items', accessor: (r) => <span className="tabular-nums font-semibold text-emerald-600">{r.completedItems} items</span>, sortable: true, sortValue: (r) => r.completedItems },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Throughput KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-label="Throughput KPIs">
        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <span className="text-[11px] font-medium uppercase text-[var(--text-muted)]">Total Completed Items</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">{data.summary.totalCompleted} items</div>
          <span className="text-xs text-[var(--text-muted)]">Closed during filter range</span>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <span className="text-[11px] font-medium uppercase text-[var(--text-muted)]">Weekly Average</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-blue-600">~{data.summary.avgPerWeek} items/wk</div>
          <span className="text-xs text-blue-600/80">Average completion rate</span>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <span className="text-[11px] font-medium uppercase text-[var(--text-muted)]">Monthly Average</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-indigo-600">~{data.summary.avgPerMonth} items/mo</div>
          <span className="text-xs text-indigo-600/80">Monthly delivery pace</span>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <span className="text-[11px] font-medium uppercase text-[var(--text-muted)]">Active Periods</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">{periods.length}</div>
          <span className="text-xs text-[var(--text-muted)]">Grouped by {groupBy}</span>
        </div>
      </section>

      {/* Throughput Chart */}
      <ChartCard
        title="Throughput Trend"
        subtitle={`Work items completed per ${groupBy}`}
        meta={data.meta}
        filters={
          <div className="flex gap-1 rounded-[var(--radius-button)] border border-[var(--border-subtle)] p-0.5 text-[11px]">
            {(['day', 'week', 'month'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-2 py-0.5 rounded font-medium capitalize transition-colors ${
                  groupBy === g ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                aria-pressed={groupBy === g}
              >
                {g}
              </button>
            ))}
          </div>
        }
      >
        <ResponsiveChart
          height={260}
          ariaLabel={`Throughput chart grouped by ${groupBy}`}
          render={(width) => {
            const area = makeArea(width);
            return (
              <g>
                <YAxis area={area} ticks={ticks} />
                <XLabels area={area} labels={periods.map((p) => p.label)} max={12} />
                {periods.map((p, i) => {
                  const layout = barLayout(periods.length, 1, area)[i];
                  const h = barHeight(p.completedItems, ticks.max, area);
                  const y = barY(p.completedItems, ticks.max, area);
                  return (
                    <rect
                      key={p.label}
                      x={layout.x[0]}
                      y={y}
                      width={layout.width}
                      height={h}
                      fill="var(--brand-primary)"
                      rx={2}
                    >
                      <title>{`${p.label}: ${p.completedItems} items completed`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          }}
        />
      </ChartCard>

      {/* Accessible Data Table */}
      <ChartCard title="Throughput Period Breakdown" subtitle={`Completed item counts by ${groupBy} period`} meta={data.meta}>
        <AccessibleTable
          columns={columns}
          data={periods}
          keyExtractor={(r) => r.label}
          pageSize={10}
        />
      </ChartCard>
    </div>
  );
}
