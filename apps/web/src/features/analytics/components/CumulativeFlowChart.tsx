'use client';

import React from 'react';
import { CumulativeFlowDto, CumulativeFlowCategory } from '@/shared/types/analytics';
import { makeArea, niceTicks, stackedAreaPaths } from '../charts/model';
import { Legend, ResponsiveChart, XLabels, YAxis } from './chartPrimitives';
import { ChartCard } from './ChartCard';

export function CumulativeFlowChart({ data }: { data: CumulativeFlowDto }) {
  // Largest category at the bottom, smallest on top (classic CFD reading).
  const ordered: CumulativeFlowCategory[] = [...data.categories].sort(
    (a, b) => totalOf(b, data) - totalOf(a, data),
  );

  const cumulative: number[][] = ordered.map((_, colIdx) =>
    data.points.map((_, i) =>
      ordered
        .slice(0, colIdx + 1)
        .reduce((acc, c) => acc + valueAt(i, c, data), 0),
    ),
  );
  const max = Math.max(...(cumulative[cumulative.length - 1] ?? []), 1);
  const ticks = niceTicks(max);

  return (
    <ChartCard
      title="Cumulative Flow"
      subtitle={`${data.groupBy} groups · ${data.bucketSizeDays}d buckets · ${data.points.length} days`}
      meta={data.meta}
    >
      <Legend
        title="Cumulative flow legend"
        items={ordered.map((c) => ({ key: c.key, label: c.label, color: c.color }))}
      />
      <ResponsiveChart
        height={280}
        ariaLabel="Cumulative flow diagram by category over time"
        render={(width) => {
          const a = makeArea(width);
          const full = stackedAreaPaths(cumulative, a, ticks.max);
          return (
            <g>
              <YAxis area={a} ticks={ticks} />
              <XLabels
                area={a}
                labels={data.points.map((p) => p.label)}
                max={9}
              />
              {full.paths.map((d, colIdx) => {
                const c = ordered[colIdx];
                return (
                  <path key={c.key} d={d} fill={c.color} opacity={0.85}>
                    <title>{`${c.label}: ${data.totals.find((t) => t.key === c.key)?.value ?? 0} items`}</title>
                  </path>
                );
              })}
              <path d={full.topEdge} fill="none" stroke="var(--bg-surface)" strokeWidth={1.5} strokeLinecap="round" />
            </g>
          );
        }}
      />
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