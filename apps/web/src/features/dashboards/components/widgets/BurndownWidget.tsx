'use client';

import React from 'react';
import { TrendingDown } from 'lucide-react';
import type { WidgetLayout } from '@/shared/types/dashboard';
import { WidgetCard } from '../WidgetCard';
import { useDashboardContext } from '../DashboardContext';

export function BurndownWidget({ widget }: { widget: WidgetLayout }) {
  const { data, isLoading, error } = useDashboardContext();
  const burndown = data?.burndown;

  const points = burndown?.points ?? [];
  const ideal = burndown?.ideal ?? [];

  const isEmpty =
    !isLoading &&
    !error &&
    (!burndown || burndown.totalScopeItems === 0 || (points.length === 0 && ideal.length === 0));

  // Determine scale for mini SVG chart
  const allValues = [
    ...points.map((p) => p.remainingPoints),
    ...ideal.map((p) => p.points),
    1,
  ];
  const maxVal = Math.max(...allValues);
  const minVal = 0;

  const width = 300;
  const height = 120;
  const padding = 15;

  const getX = (index: number, total: number) => {
    if (total <= 1) return padding;
    return padding + (index / (total - 1)) * (width - 2 * padding);
  };

  const getY = (val: number) => {
    const range = maxVal - minVal || 1;
    return height - padding - ((val - minVal) / range) * (height - 2 * padding);
  };

  // Build SVG path for ideal line
  const idealPath =
    ideal.length > 0
      ? ideal
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i, ideal.length)} ${getY(p.points)}`)
          .join(' ')
      : '';

  // Build SVG path for actual points
  const actualPath =
    points.length > 0
      ? points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i, points.length)} ${getY(p.remainingPoints)}`)
          .join(' ')
      : '';

  const actualArea =
    points.length > 1
      ? `${actualPath} L ${getX(points.length - 1, points.length)} ${height - padding} L ${getX(0, points.length)} ${height - padding} Z`
      : '';

  return (
    <WidgetCard
      widget={widget}
      title="Burndown"
      description="Active sprint effort trend"
      icon={TrendingDown}
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyTitle="No burndown data"
      emptyDescription="Sprint burndown will calculate as items are scoped and completed."
    >
      {burndown && !isEmpty && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--text-secondary)]">
              Remaining vs Ideal
            </span>
            <span className="font-semibold text-[var(--brand-primary)]">
              {burndown.remainingPoints} pts remaining
            </span>
          </div>

          <div className="w-full overflow-hidden rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)]/30 p-2">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-28 overflow-visible"
              preserveAspectRatio="none"
            >
              {/* Baseline */}
              <line
                x1={padding}
                y1={height - padding}
                x2={width - padding}
                y2={height - padding}
                stroke="currentColor"
                className="text-[var(--border-subtle)]"
                strokeWidth="1"
              />

              {/* Ideal guide line (dashed) */}
              {idealPath && (
                <path
                  d={idealPath}
                  fill="none"
                  stroke="currentColor"
                  className="text-slate-400 dark:text-slate-500"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              )}

              {/* Actual area shading */}
              {actualArea && (
                <path
                  d={actualArea}
                  fill="currentColor"
                  className="text-[var(--brand-primary)] opacity-15"
                />
              )}

              {/* Actual line */}
              {actualPath && (
                <path
                  d={actualPath}
                  fill="none"
                  stroke="currentColor"
                  className="text-[var(--brand-primary)]"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points */}
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={getX(i, points.length)}
                  cy={getY(p.remainingPoints)}
                  r="3"
                  className="fill-[var(--brand-primary)] stroke-[var(--bg-surface)] stroke-2"
                />
              ))}
            </svg>
          </div>

          <div className="flex items-center justify-center gap-4 text-[11px] text-[var(--text-muted)]">
            <div className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 bg-slate-400 border-dashed" />
              <span>Ideal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--brand-primary)]" />
              <span>Actual Remaining</span>
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
