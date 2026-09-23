'use client';

import React from 'react';
import { VelocityDto } from '@/shared/types/analytics';
import { barHeight, barLayout, barY, makeArea, niceTicks } from '../charts/model';
import { Legend, ResponsiveChart, XLabels, YAxis } from './chartPrimitives';
import { ChartCard } from './ChartCard';

export function VelocityChart({ data }: { data: VelocityDto }) {
  const rows = data.iterations;
  const max = Math.max(
    ...rows.flatMap((r) => [r.committedPoints, r.completedPoints]),
    1,
  );
  const ticks = niceTicks(max);

  return (
    <ChartCard
      title="Velocity"
      subtitle={`${data.summary.iterations} sprints · avg ${data.summary.avgCompletedPoints} pts/sprint`}
      meta={data.meta}
    >
      <Legend
        title="Velocity legend"
        items={[
          { key: 'committed', label: 'Committed', color: 'var(--border-strong)' },
          { key: 'completed', label: 'Completed', color: 'var(--brand-primary)' },
        ]}
      />
      <ResponsiveChart
        height={280}
        ariaLabel="Velocity per sprint: committed versus completed points"
        render={(width) => {
          const a = makeArea(width);
          const hasEmpty = rows.some((r) => r.completedPoints === 0 && r.committedPoints === 0);
          return (
            <g>
              <YAxis area={a} ticks={ticks} />
              <XLabels
                area={a}
                labels={rows.map((r) => r.name.replace(/^Sprint\s*/i, 'S'))}
                max={9}
              />
              {hasEmpty ? (
                <text
                  x={a.left + a.width / 2}
                  y={a.top + a.height / 2}
                  textAnchor="middle"
                  fontSize={13}
                  fill="var(--text-muted)"
                >
                  No committed work yet
                </text>
              ) : null}
              {rows.map((r, i) => {
                const layout = barLayout(rows.length, 2, a)[i];
                const committed = { x: layout.x[0], w: layout.width, h: barHeight(r.committedPoints, ticks.max, a), y: barY(r.committedPoints, ticks.max, a) };
                const completed = { x: layout.x[1], w: layout.width, h: barHeight(r.completedPoints, ticks.max, a), y: barY(r.completedPoints, ticks.max, a) };
                const ratio =
                  r.completionRatio === null ? 0 : Math.round(r.completionRatio * 100);
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
                      <title>{`${r.name} — committed ${r.committedPoints} pts`}</title>
                    </rect>
                    <rect
                      x={completed.x}
                      y={completed.y}
                      width={completed.w}
                      height={completed.h}
                      fill="var(--brand-primary)"
                      rx={2}
                    >
                      <title>{`${r.name} — completed ${r.completedPoints} pts (${ratio}%)`}</title>
                    </rect>
                  </g>
                );
              })}
            </g>
          );
        }}
      />
    </ChartCard>
  );
}