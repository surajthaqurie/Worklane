'use client';

import React, { useState } from 'react';
import { AnalyticsQueryParams } from '../api/analyticsApi';
import { useCumulativeFlow, useTrends } from '../hooks/useAnalytics';
import { CumulativeFlowChart } from './CumulativeFlowChart';
import { ChartCard } from './ChartCard';
import { AccessibleTable, Column } from './AccessibleTable';
import { TrendPointDto } from '@/shared/types/analytics';
import { formatHoursCompact } from '../charts/model';

interface TrendsReportViewProps {
  projectId: string;
  queryParams: AnalyticsQueryParams;
}

export function TrendsReportView({ projectId, queryParams }: TrendsReportViewProps) {
  const [groupBy, setGroupBy] = useState<'category' | 'state'>('category');
  const [bucketSizeDays, setBucketSizeDays] = useState<number>(7);

  const cumulativeFlow = useCumulativeFlow(projectId, {
    ...queryParams,
    groupBy,
    bucketSizeDays,
  });

  const trends = useTrends(projectId, queryParams);

  if (cumulativeFlow.isLoading || trends.isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-72 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
        <div className="h-64 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
      </div>
    );
  }

  const trendsData = trends.data;
  const trendPoints = trendsData?.points || [];

  const columns: Column<TrendPointDto>[] = [
    { key: 'date', header: 'Period / Date', accessor: (r) => <span className="font-medium text-[var(--text-primary)]">{r.date}</span>, sortable: true, sortValue: (r) => r.date },
    { key: 'openCount', header: 'Open Work Items', accessor: (r) => <span className="tabular-nums text-blue-600 font-medium">{r.openCount}</span>, sortable: true, sortValue: (r) => r.openCount },
    { key: 'completedCount', header: 'Completed Work Items', accessor: (r) => <span className="tabular-nums text-emerald-600 font-semibold">{r.completedCount}</span>, sortable: true, sortValue: (r) => r.completedCount },
    { key: 'throughput', header: 'Throughput (items)', accessor: (r) => <span className="tabular-nums">{r.throughput} items</span>, sortable: true, sortValue: (r) => r.throughput },
    { key: 'avgCycleHours', header: 'Avg Cycle Duration', accessor: (r) => <span className="tabular-nums font-mono text-xs">{formatHoursCompact(r.avgCycleHours)}</span>, sortable: true, sortValue: (r) => r.avgCycleHours },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Cumulative Flow Diagram */}
      <CumulativeFlowChart
        data={cumulativeFlow.data}
        isLoading={cumulativeFlow.isLoading}
        error={cumulativeFlow.error}
        onRetry={() => cumulativeFlow.refetch()}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        bucketSizeDays={bucketSizeDays}
        onBucketSizeChange={setBucketSizeDays}
      />

      {/* Historical Trend Table */}
      <ChartCard title="Historical Performance Trends" subtitle="Open items, completion pace, throughput, and average cycle duration over time" meta={trendsData?.meta}>
        <AccessibleTable
          columns={columns}
          data={trendPoints}
          keyExtractor={(r) => r.date}
          pageSize={10}
        />
      </ChartCard>
    </div>
  );
}
