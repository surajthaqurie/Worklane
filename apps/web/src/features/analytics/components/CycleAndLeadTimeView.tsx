'use client';

import React, { useState } from 'react';
import { AnalyticsQueryParams } from '../api/analyticsApi';
import { useCycleTime, useLeadTime } from '../hooks/useAnalytics';
import { FlowTimeChart } from './FlowTimeChart';
import { AccessibleTable, Column } from './AccessibleTable';
import { ChartCard } from './ChartCard';
import { formatHoursCompact } from '../charts/model';
import { WorkItemDurationDto } from '@/shared/types/analytics';

interface CycleAndLeadTimeViewProps {
  projectId: string;
  queryParams: AnalyticsQueryParams;
}

export function CycleAndLeadTimeView({ projectId, queryParams }: CycleAndLeadTimeViewProps) {
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const [activeMetric, setActiveMetric] = useState<'cycle' | 'lead' | 'both'>('both');

  const cycleTime = useCycleTime(projectId, { ...queryParams, type: selectedType });
  const leadTime = useLeadTime(projectId, { ...queryParams, type: selectedType });

  const isLoading = cycleTime.isLoading || leadTime.isLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-64 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
        <div className="h-64 rounded-[var(--radius-card)] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]" />
      </div>
    );
  }

  // Combine items for drill-down table
  const items: WorkItemDurationDto[] = cycleTime.data?.items || leadTime.data?.items || [];

  const columns: Column<WorkItemDurationDto>[] = [
    { key: 'id', header: 'ID / Key', accessor: (r) => <span className="font-mono text-xs">{r.id.slice(0, 8)}</span>, sortable: true, sortValue: (r) => r.id },
    { key: 'title', header: 'Work Item Title', accessor: (r) => <span className="font-medium text-[var(--text-primary)]">{r.title}</span>, sortable: true, sortValue: (r) => r.title },
    { key: 'type', header: 'Type', accessor: (r) => <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] capitalize">{r.type}</span>, sortable: true, sortValue: (r) => r.type },
    { key: 'completedAt', header: 'Completed At', accessor: (r) => <span className="text-xs text-[var(--text-muted)]">{r.completedAt ? new Date(r.completedAt).toLocaleDateString() : 'N/A'}</span>, sortable: true, sortValue: (r) => (r.completedAt ? new Date(r.completedAt).getTime() : 0) },
    { key: 'cycleHours', header: 'Cycle Time (Started → Completed)', accessor: (r) => <span className="tabular-nums font-semibold text-blue-600">{formatHoursCompact(r.cycleHours)}</span>, sortable: true, sortValue: (r) => r.cycleHours ?? 0 },
    { key: 'leadHours', header: 'Lead Time (Created → Completed)', accessor: (r) => <span className="tabular-nums font-semibold text-indigo-600">{formatHoursCompact(r.leadHours)}</span>, sortable: true, sortValue: (r) => r.leadHours ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Metric Mode Selector */}
      <div className="flex items-center justify-between bg-[var(--bg-surface)] p-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)]">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Cycle Time vs Lead Time</h3>
          <p className="text-xs text-[var(--text-muted)]">
            <strong className="text-[var(--text-secondary)]">Cycle Time</strong> = Started → Completed elapsed time. <strong className="text-[var(--text-secondary)]">Lead Time</strong> = Created → Completed elapsed time.
          </p>
        </div>
        <div className="flex items-center rounded-[var(--radius-button)] border border-[var(--border-subtle)] p-0.5 text-xs font-medium">
          {(['both', 'cycle', 'lead'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setActiveMetric(m)}
              className={`px-3 py-1 rounded capitalize transition-colors ${
                activeMetric === m ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {m === 'both' ? 'Compare Both' : `${m} time`}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      <div className={`grid grid-cols-1 ${activeMetric === 'both' ? 'lg:grid-cols-2' : 'grid-cols-1'} gap-6`}>
        {(activeMetric === 'both' || activeMetric === 'cycle') && (
          <FlowTimeChart
            title="Cycle Time (Started → Completed)"
            data={cycleTime.data}
            isLoading={cycleTime.isLoading}
            error={cycleTime.error}
            onRetry={() => cycleTime.refetch()}
            selectedType={selectedType}
            onSelectType={setSelectedType}
          />
        )}

        {(activeMetric === 'both' || activeMetric === 'lead') && (
          <FlowTimeChart
            title="Lead Time (Created → Completed)"
            data={leadTime.data}
            isLoading={leadTime.isLoading}
            error={leadTime.error}
            onRetry={() => leadTime.refetch()}
            selectedType={selectedType}
            onSelectType={setSelectedType}
          />
        )}
      </div>

      {/* Items Duration Drill-Down Table */}
      <ChartCard title="Completed Items Flow Duration Table" subtitle="Detailed elapsed cycle and lead times for completed work items" meta={cycleTime.data?.meta}>
        <AccessibleTable
          columns={columns}
          data={items}
          keyExtractor={(r) => r.id}
          pageSize={10}
        />
      </ChartCard>
    </div>
  );
}
