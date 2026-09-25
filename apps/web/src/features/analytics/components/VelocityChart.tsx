'use client';

import React, { useState } from 'react';
import { VelocityDto } from '@/shared/types/analytics';
import { barHeight, barLayout, barY, makeArea, niceTicks } from '../charts/model';
import { Legend, ResponsiveChart, XLabels, YAxis } from './chartPrimitives';
import { ChartCard } from './ChartCard';

export interface VelocityChartProps {
  data?: VelocityDto | null;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  dateRange?: string;
  metric?: 'points' | 'items';
  onMetricChange?: (metric: 'points' | 'items') => void;
}

export function VelocityChart({
  data,
  isLoading = false,
  error = null,
  onRetry,
  dateRange,
  metric: externalMetric,
  onMetricChange,
}: VelocityChartProps) {
  const [internalMetric, setInternalMetric] = useState<'points' | 'items'>('points');
  const metric = externalMetric ?? internalMetric;
  const setMetric = onMetricChange ?? setInternalMetric;

  const rows = data?.iterations ?? [];
  const max = Math.max(
    ...rows.flatMap((r) =>
      metric === 'points' ? [r.committedPoints, r.completedPoints] : [r.committedItems, r.completedItems],
    ),
    1,
  );
  const ticks = niceTicks(max);

  const effectiveDateRange = dateRange ?? (data ? `${data.from} → ${data.to}` : undefined);
  const isEmpty = !isLoading && !error && (!data || rows.length === 0);

  const filtersNode = (
    <div className="flex items-center rounded-[var(--radius-button)] border border-[var(--border-subtle)] p-0.5 text-[11px]">
      <button
        type="button"
        onClick={() => setMetric('points')}
        className={`px-2 py-0.5 rounded font-medium transition-colors ${
          metric === 'points'
            ? 'bg-[var(--brand-primary)] text-white'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
        aria-pressed={metric === 'points'}
      >
        Points
      </button>
      <button
        type="button"
        onClick={() => setMetric('items')}
        className={`px-2 py-0.5 rounded font-medium transition-colors ${
          metric === 'items'
            ? 'bg-[var(--brand-primary)] text-white'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
        aria-pressed={metric === 'items'}
      >
        Items
      </button>
    </div>
  );

  return (
    <ChartCard
      title="Velocity"
      subtitle={
        data
          ? `${data.summary.iterations} sprints · avg ${
              metric === 'points'
                ? `${data.summary.avgCompletedPoints} pts/sprint`
                : `${rows.length > 0 ? (rows.reduce((acc, r) => acc + r.completedItems, 0) / rows.length).toFixed(1) : 0} items/sprint`
            }`
          : 'Committed vs completed across sprints'
      }
      meta={data?.meta}
      dateRange={effectiveDateRange}
      filters={filtersNode}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      emptyTitle="No sprints found"
      emptyMessage="No sprints overlap the selected date window."
      ariaLabel={
        data
          ? `Velocity across ${data.summary.iterations} sprints with average ${data.summary.avgCompletedPoints} completed points.`
          : 'Velocity Chart'
      }
    >
      {data && (
        <>
          <Legend
            title="Velocity legend"
            items={[
              {
                key: 'committed',
                label: metric === 'points' ? 'Committed points' : 'Committed items',
                color: 'var(--border-strong)',
              },
              {
                key: 'completed',
                label: metric === 'points' ? 'Completed points' : 'Completed items',
                color: 'var(--brand-primary)',
              },
            ]}
          />
          <ResponsiveChart
            height={280}
            ariaLabel={`Velocity per sprint: committed versus completed ${metric}`}
            render={(width) => {
              const a = makeArea(width);
              return (
                <g>
                  <desc>
                    {`Velocity chart showing ${rows.length} sprints. Total completed: ${data.summary.totalCompletedPoints} points.`}
                  </desc>
                  <YAxis area={a} ticks={ticks} />
                  <XLabels
                    area={a}
                    labels={rows.map((r) => r.name.replace(/^Sprint\s*/i, 'S'))}
                    max={9}
                  />
                  {rows.map((r, i) => {
                    const layout = barLayout(rows.length, 2, a)[i];
                    const committedVal = metric === 'points' ? r.committedPoints : r.committedItems;
                    const completedVal = metric === 'points' ? r.completedPoints : r.completedItems;
                    const committed = {
                      x: layout.x[0],
                      w: layout.width,
                      h: barHeight(committedVal, ticks.max, a),
                      y: barY(committedVal, ticks.max, a),
                    };
                    const completed = {
                      x: layout.x[1],
                      w: layout.width,
                      h: barHeight(completedVal, ticks.max, a),
                      y: barY(completedVal, ticks.max, a),
                    };
                    const ratio =
                      r.completionRatio === null ? 0 : Math.round(r.completionRatio * 100);
                    const unit = metric === 'points' ? 'pts' : 'items';
                    return (
                      <g key={r.iterationId}>
                        <rect
                          x={committed.x}
                          y={committed.y}
                          width={committed.w}
                          height={committed.h}
                          fill="var(--border-strong)"
                          rx={2}
                        >
                          <title>{`${r.name} — committed: ${committedVal} ${unit}`}</title>
                        </rect>
                        <rect
                          x={completed.x}
                          y={completed.y}
                          width={completed.w}
                          height={completed.h}
                          fill="var(--brand-primary)"
                          rx={2}
                        >
                          <title>{`${r.name} — completed: ${completedVal} ${unit} (${ratio}%)`}</title>
                        </rect>
                      </g>
                    );
                  })}
                </g>
              );
            }}
          />

          {/* Accessible tabular representation for screen readers */}
          <table className="sr-only">
            <caption>Velocity data table</caption>
            <thead>
              <tr>
                <th scope="col">Sprint</th>
                <th scope="col">Start Date</th>
                <th scope="col">End Date</th>
                <th scope="col">Committed ({metric})</th>
                <th scope="col">Completed ({metric})</th>
                <th scope="col">Completion Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.iterationId}>
                  <td>{r.name}</td>
                  <td>{r.startDate}</td>
                  <td>{r.endDate}</td>
                  <td>{metric === 'points' ? r.committedPoints : r.committedItems}</td>
                  <td>{metric === 'points' ? r.completedPoints : r.completedItems}</td>
                  <td>{r.completionRatio !== null ? `${Math.round(r.completionRatio * 100)}%` : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </ChartCard>
  );
}