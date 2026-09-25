'use client';

import React from 'react';
import { BurndownDto } from '@/shared/types/analytics';
import { makeArea, niceTicks } from '../charts/model';
import { Legend, markerPosition, ResponsiveChart, XLabels, YAxis } from './chartPrimitives';
import { ChartCard } from './ChartCard';

export interface SprintBurndownChartProps {
  data?: BurndownDto | null;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  iterations?: Array<{ id: string; name: string }>;
  selectedIterationId?: string;
  onSelectIteration?: (id: string) => void;
  dateRange?: string;
}

export function SprintBurndownChart({
  data,
  isLoading = false,
  error = null,
  onRetry,
  iterations,
  selectedIterationId,
  onSelectIteration,
  dateRange,
}: SprintBurndownChartProps) {
  const points = data?.points ?? [];
  const remaining = points.map((p) => p.remainingPoints);
  const ideal = data?.ideal.map((p) => p.points) ?? [];
  const max = Math.max(...remaining, ...ideal, 1);

  const effectiveDateRange = dateRange ?? (data ? `${data.startDate} → ${data.endDate}` : undefined);
  const isEmpty = !isLoading && !error && (!data || data.totalScopeItems === 0 || points.length === 0);

  const filtersNode = iterations && iterations.length > 0 && onSelectIteration ? (
    <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
      <span className="sr-only">Select sprint for burndown</span>
      <select
        value={selectedIterationId ?? data?.iterationId ?? ''}
        onChange={(e) => onSelectIteration(e.target.value)}
        className="rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[12px] text-[var(--text-primary)]"
        aria-label="Sprint selection for burndown"
      >
        {iterations.map((it) => (
          <option key={it.id} value={it.id}>
            {it.name}
          </option>
        ))}
      </select>
    </label>
  ) : null;

  const actionsNode = data && !isEmpty ? (
    <span className="text-[12px] text-[var(--text-muted)] font-medium">
      {data.completedPoints} pts done · {data.remainingPoints} pts remaining
    </span>
  ) : null;

  return (
    <ChartCard
      title="Sprint Burndown"
      subtitle={data ? `${data.iterationName} · Scope: ${data.totalScopePoints} pts (${data.totalScopeItems} items)` : 'Historical scope burn line'}
      meta={data?.meta}
      dateRange={effectiveDateRange}
      filters={filtersNode}
      actions={actionsNode}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      emptyTitle="No sprint items"
      emptyMessage="No work items were scoped to this sprint at the selected time."
      ariaLabel={data ? `Burndown for ${data.iterationName}: ${data.remainingPoints} points remaining out of ${data.totalScopePoints} total` : 'Sprint Burndown'}
    >
      {data && (
        <>
          <Legend
            title="Burndown legend"
            items={[
              { key: 'remaining', label: 'Remaining points', color: 'var(--brand-primary)' },
              { key: 'ideal', label: 'Ideal burn line', color: 'var(--text-muted)' },
            ]}
          />
          <ResponsiveChart
            height={280}
            ariaLabel={`Sprint Burndown for ${data.iterationName}: ${data.remainingPoints} points remaining out of ${data.totalScopePoints} total scope.`}
            render={(width) => {
              const a = makeArea(width);
              const ticks = niceTicks(max);
              return (
                <g>
                  <desc>
                    {`Burndown chart for ${data.iterationName}. Started at ${data.totalScopePoints} points. Currently ${data.completedPoints} points completed and ${data.remainingPoints} points remaining.`}
                  </desc>
                  <YAxis area={a} ticks={ticks} />
                  <XLabels
                    area={a}
                    labels={points.map((p) => p.label)}
                    max={10}
                  />
                  <path
                    d={pathFor(ideal, a, max)}
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  />
                  <path
                    d={pathFor(remaining, a, max)}
                    fill="none"
                    stroke="var(--brand-primary)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  />
                  {remaining.map((v, i) => {
                    const p = markerPosition(remaining, i, a, max);
                    const pt = points[i];
                    return (
                      <circle
                        key={`rp-${i}`}
                        cx={p.x}
                        cy={p.y}
                        r={2.5}
                        fill="var(--brand-primary)"
                      >
                        <title>{`${pt?.date ?? ''}: ${v} pts remaining (${pt?.completedPoints ?? 0} pts done)`}</title>
                      </circle>
                    );
                  })}
                </g>
              );
            }}
          />

          {/* Accessible tabular representation for screen readers */}
          <table className="sr-only">
            <caption>{`Burndown data table for ${data.iterationName}`}</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Remaining Points</th>
                <th scope="col">Scope Points</th>
                <th scope="col">Completed Points</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td>{p.remainingPoints}</td>
                  <td>{p.scopePoints}</td>
                  <td>{p.completedPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </ChartCard>
  );
}

function pathFor(values: number[], area: ReturnType<typeof makeArea>, max: number): string {
  return values
    .map((v, i) => {
      const x =
        area.left + (values.length <= 1 ? area.width / 2 : (area.width / (values.length - 1)) * i);
      const y = round(area.top + area.height - (v / max) * area.height);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}