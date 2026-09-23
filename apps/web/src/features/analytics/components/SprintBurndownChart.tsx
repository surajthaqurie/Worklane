'use client';

import React from 'react';
import { BurndownDto } from '@/shared/types/analytics';
import { makeArea, niceTicks } from '../charts/model';
import { Legend, markerPosition, ResponsiveChart, XLabels, YAxis } from './chartPrimitives';
import { ChartCard } from './ChartCard';

export function SprintBurndownChart({ data }: { data: BurndownDto }) {
  const remaining = data.points.map((p) => p.remainingPoints);
  const ideal = data.ideal.map((p) => p.points);
  const max = Math.max(...remaining, ...ideal, 1);

  return (
    <ChartCard
      title="Sprint Burndown"
      subtitle={`${data.iterationName} · ${data.startDate} → ${data.endDate}`}
      meta={data.meta}
      actions={
        <span className="text-[12px] text-[var(--text-muted)]">
          {data.completedPoints} done · {data.remainingPoints} remaining
        </span>
      }
    >
      <Legend
        title="Burndown legend"
        items={[
          { key: 'remaining', label: 'Remaining', color: 'var(--brand-primary)' },
          { key: 'ideal', label: 'Ideal', color: 'var(--text-muted)' },
        ]}
      />
      <ResponsiveChart
        height={280}
        ariaLabel={`Burndown for ${data.iterationName}`}
        render={(width) => {
          const a = makeArea(width);
          const ticks = niceTicks(max);
          return (
            <g>
              <YAxis area={a} ticks={ticks} />
              <XLabels
                area={a}
                labels={data.points.map((p) => p.label)}
                max={10}
              />
              <path
                d={pathFor(ideal, a, max)}
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                strokeLinecap="round"
              />
              <path
                d={pathFor(remaining, a, max)}
                fill="none"
                stroke="var(--brand-primary)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {remaining.map((v, i) => {
                const p = markerPosition(remaining, i, a, max);
                return <circle key={`rp-${i}`} cx={p.x} cy={p.y} r={2.5} fill="var(--brand-primary)" aria-hidden="true" />;
              })}
            </g>
          );
        }}
      />
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