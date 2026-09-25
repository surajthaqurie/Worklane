'use client';

import React from 'react';
import { FlowTimeDto } from '@/shared/types/analytics';
import { barHeight, barY, formatHoursCompact, makeArea, niceTicks } from '../charts/model';
import { ResponsiveChart, XLabels, YAxis } from './chartPrimitives';
import { ChartCard } from './ChartCard';

const STAT_CARDS: Array<{ key: keyof FlowTimeDto['stats']; label: string; get: (s: FlowTimeDto['stats']) => string }> = [
  { key: 'count', label: 'Items', get: (s) => String(s.count) },
  { key: 'medianHours', label: 'Median', get: (s) => formatHoursCompact(s.medianHours) },
  { key: 'p85Hours', label: 'p85', get: (s) => formatHoursCompact(s.p85Hours) },
  { key: 'p95Hours', label: 'p95', get: (s) => formatHoursCompact(s.p95Hours) },
  { key: 'avgHours', label: 'Average', get: (s) => formatHoursCompact(s.avgHours) },
];

export interface FlowTimeChartProps {
  title: string;
  data?: FlowTimeDto | null;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  dateRange?: string;
  selectedType?: string;
  onSelectType?: (type?: string) => void;
  types?: string[];
}

export function FlowTimeChart({
  title,
  data,
  isLoading = false,
  error = null,
  onRetry,
  dateRange,
  selectedType,
  onSelectType,
  types = ['STORY', 'BUG', 'TASK', 'EPIC'],
}: FlowTimeChartProps) {
  const stats = data?.stats;
  const buckets = stats?.distribution ?? [];
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const ticks = niceTicks(maxCount);

  const effectiveDateRange = dateRange ?? (data ? `${data.from} → ${data.to}` : undefined);
  const isEmpty = !isLoading && !error && (!data || !stats || stats.count === 0);

  const filtersNode = onSelectType ? (
    <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
      <span className="sr-only">{`Filter ${title} by work item type`}</span>
      <select
        value={selectedType ?? data?.type ?? ''}
        onChange={(e) => onSelectType(e.target.value ? e.target.value : undefined)}
        className="rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[12px] text-[var(--text-primary)]"
        aria-label={`${title} type filter`}
      >
        <option value="">All Types</option>
        {types.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  ) : null;

  return (
    <ChartCard
      title={title}
      subtitle={
        data
          ? `${data.type ? `${data.type}s · ` : 'All types · '}${stats?.count ?? 0} items completed in window`
          : `${title} distribution for completed items`
      }
      meta={data?.meta}
      dateRange={effectiveDateRange}
      filters={filtersNode}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      emptyTitle={`No ${title.toLowerCase()} data`}
      emptyMessage="No work items were completed in this date window matching the selected filters."
      ariaLabel={
        stats
          ? `${title} distribution across ${stats.count} completed items: median ${formatHoursCompact(stats.medianHours)}, p85 ${formatHoursCompact(stats.p85Hours)}.`
          : title
      }
    >
      {data && stats && (
        <>
          <dl className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-4" aria-label={`${title} summary statistics`}>
            {STAT_CARDS.map((card) => (
              <div
                key={card.key}
                className="rounded-[var(--radius-button)] bg-[var(--bg-surface-raised)] px-3 py-2"
              >
                <dt className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{card.label}</dt>
                <dd className="text-[15px] font-semibold text-[var(--text-primary)] mt-0.5">
                  {card.get(stats)}
                </dd>
              </div>
            ))}
          </dl>
          <ResponsiveChart
            height={200}
            ariaLabel={`${title} distribution histogram`}
            render={(width) => {
              const a = makeArea(width);
              const slot = a.width / (buckets.length || 1);
              return (
                <g>
                  <desc>
                    {`${title} histogram with ${stats.count} items. Median duration: ${formatHoursCompact(stats.medianHours)}.`}
                  </desc>
                  <YAxis area={a} ticks={ticks} />
                  <XLabels area={a} labels={buckets.map((b) => b.label)} max={buckets.length} />
                  {buckets.map((b, i) => {
                    const bw = Math.max(4, slot * 0.5);
                    const x = a.left + slot * i + (slot - bw) / 2;
                    const y = barY(b.count, ticks.max, a);
                    const h = barHeight(b.count, ticks.max, a);
                    return (
                      <rect
                        key={b.label}
                        x={x}
                        y={y}
                        width={bw}
                        height={h}
                        rx={2}
                        fill="var(--brand-primary)"
                        opacity={0.85}
                      >
                        <title>{`${b.label}: ${b.count} items`}</title>
                      </rect>
                    );
                  })}
                </g>
              );
            }}
          />

          {/* Accessible tabular representation for screen readers */}
          <table className="sr-only">
            <caption>{`${title} distribution data table`}</caption>
            <thead>
              <tr>
                <th scope="col">Duration Bucket</th>
                <th scope="col">Item Count</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.label}>
                  <td>{b.label}</td>
                  <td>{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </ChartCard>
  );
}