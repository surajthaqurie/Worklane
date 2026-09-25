'use client';

import React from 'react';
import { CumulativeFlowDto, CumulativeFlowCategory } from '@/shared/types/analytics';
import { makeArea, niceTicks, stackedAreaPaths } from '../charts/model';
import { Legend, ResponsiveChart, XLabels, YAxis } from './chartPrimitives';
import { ChartCard } from './ChartCard';

export interface CumulativeFlowChartProps {
  data?: CumulativeFlowDto | null;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  dateRange?: string;
  groupBy?: 'category' | 'state';
  onGroupByChange?: (g: 'category' | 'state') => void;
  bucketSizeDays?: number;
  onBucketSizeChange?: (b: number) => void;
}

export function CumulativeFlowChart({
  data,
  isLoading = false,
  error = null,
  onRetry,
  dateRange,
  groupBy,
  onGroupByChange,
  bucketSizeDays,
  onBucketSizeChange,
}: CumulativeFlowChartProps) {
  const points = data?.points ?? [];
  const categories = data?.categories ?? [];

  // Largest category at the bottom, smallest on top (classic CFD reading).
  const ordered: CumulativeFlowCategory[] = data
    ? [...categories].sort((a, b) => totalOf(b, data) - totalOf(a, data))
    : [];

  const cumulative: number[][] = data
    ? ordered.map((_, colIdx) =>
        points.map((_, i) =>
          ordered
            .slice(0, colIdx + 1)
            .reduce((acc, c) => acc + valueAt(i, c, data), 0),
        ),
      )
    : [];

  const max = Math.max(...(cumulative[cumulative.length - 1] ?? []), 1);
  const ticks = niceTicks(max);

  const effectiveDateRange = dateRange ?? (data ? `${data.from} → ${data.to}` : undefined);
  const isEmpty =
    !isLoading &&
    !error &&
    (!data || points.length === 0 || points.every((p) => p.series.every((s) => s.value === 0)));

  const filtersNode = (
    <div className="flex items-center gap-2 flex-wrap">
      {onGroupByChange && (
        <div className="flex items-center rounded-[var(--radius-button)] border border-[var(--border-subtle)] p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => onGroupByChange('category')}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              (groupBy ?? data?.groupBy ?? 'category') === 'category'
                ? 'bg-[var(--brand-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            aria-pressed={(groupBy ?? data?.groupBy) === 'category'}
          >
            Category
          </button>
          <button
            type="button"
            onClick={() => onGroupByChange('state')}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              (groupBy ?? data?.groupBy) === 'state'
                ? 'bg-[var(--brand-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            aria-pressed={(groupBy ?? data?.groupBy) === 'state'}
          >
            State
          </button>
        </div>
      )}

      {onBucketSizeChange && (
        <div className="flex items-center rounded-[var(--radius-button)] border border-[var(--border-subtle)] p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => onBucketSizeChange(1)}
            className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
              (bucketSizeDays ?? data?.bucketSizeDays ?? 1) === 1
                ? 'bg-[var(--brand-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            aria-pressed={(bucketSizeDays ?? data?.bucketSizeDays) === 1}
          >
            1d
          </button>
          <button
            type="button"
            onClick={() => onBucketSizeChange(7)}
            className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
              (bucketSizeDays ?? data?.bucketSizeDays) === 7
                ? 'bg-[var(--brand-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            aria-pressed={(bucketSizeDays ?? data?.bucketSizeDays) === 7}
          >
            7d
          </button>
        </div>
      )}
    </div>
  );

  return (
    <ChartCard
      title="Cumulative Flow"
      subtitle={
        data
          ? `${data.groupBy} groups · ${data.bucketSizeDays}d buckets · ${data.points.length} periods`
          : 'Distribution of work items across workflow stages over time'
      }
      meta={data?.meta}
      dateRange={effectiveDateRange}
      filters={filtersNode}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      emptyTitle="No cumulative flow data"
      emptyMessage="No work items were active in the selected window."
      ariaLabel={
        data
          ? `Cumulative flow diagram showing ${ordered.map((c) => `${c.label}: ${data.totals.find((t) => t.key === c.key)?.value ?? 0}`).join(', ')}`
          : 'Cumulative Flow Chart'
      }
    >
      {data && (
        <>
          <Legend
            title="Cumulative flow legend"
            items={ordered.map((c) => ({ key: c.key, label: c.label, color: c.color }))}
          />
          <ResponsiveChart
            height={280}
            ariaLabel={`Cumulative flow diagram grouped by ${data.groupBy}`}
            render={(width) => {
              const a = makeArea(width);
              const full = stackedAreaPaths(cumulative, a, ticks.max);
              return (
                <g>
                  <desc>
                    {`Cumulative flow diagram showing ${ordered.length} stages over ${data.points.length} time buckets.`}
                  </desc>
                  <YAxis area={a} ticks={ticks} />
                  <XLabels
                    area={a}
                    labels={points.map((p) => p.label)}
                    max={9}
                  />
                  {full.paths.map((d, colIdx) => {
                    const c = ordered[colIdx];
                    const totalVal = data.totals.find((t) => t.key === c.key)?.value ?? 0;
                    return (
                      <path key={c.key} d={d} fill={c.color} opacity={0.85}>
                        <title>{`${c.label}: ${totalVal} items at end of period`}</title>
                      </path>
                    );
                  })}
                  <path
                    d={full.topEdge}
                    fill="none"
                    stroke="var(--bg-surface)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    aria-hidden="true"
                  />
                </g>
              );
            }}
          />

          {/* Accessible tabular representation for screen readers */}
          <table className="sr-only">
            <caption>Cumulative Flow data table</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                {ordered.map((c) => (
                  <th key={c.key} scope="col">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  {ordered.map((c) => (
                    <td key={c.key}>{valueAt(i, c, data)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </ChartCard>
  );
}

function valueAt(i: number, c: CumulativeFlowCategory, data: CumulativeFlowDto): number {
  return data.points[i]?.series.find((s) => s.key === c.key)?.value ?? 0;
}

function totalOf(c: CumulativeFlowCategory, data: CumulativeFlowDto): number {
  return data.points.reduce(
    (acc, p) => acc + (p.series.find((s) => s.key === c.key)?.value ?? 0),
    0,
  );
}