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

export function FlowTimeChart({ data, title }: { data: FlowTimeDto; title: string }) {
  const stats = data.stats;
  const buckets = stats.distribution;
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const ticks = niceTicks(maxCount);

  return (
    <ChartCard
      title={title}
      subtitle={`${data.type ? `${data.type}s · ` : ''}${data.from} → ${data.to} · completed items in window`}
      meta={data.meta}
    >
      <dl className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-4">
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
          const slot = a.width / buckets.length;
          return (
            <g>
              <YAxis area={a} ticks={ticks} />
              <XLabels area={a} labels={buckets.map((b) => b.label)} max={buckets.length} />
              {buckets.map((b, i) => {
                const bw = Math.max(4, slot * 0.5);
                const x = a.left + slot * i + (slot - bw) / 2;
                const y = barY(b.count, ticks.max, a);
                const h = barHeight(b.count, ticks.max, a);
                return (
                  <rect key={b.label} x={x} y={y} width={bw} height={h} rx={2} fill="var(--brand-primary)" opacity={0.85}>
                    <title>{`${b.label}: ${b.count} items`}</title>
                  </rect>
                );
              })}
              {stats.count === 0 ? (
                <text
                  x={a.left + a.width / 2}
                  y={a.top + a.height / 2}
                  textAnchor="middle"
                  fontSize={13}
                  fill="var(--text-muted)"
                >
                  No items completed in this window
                </text>
              ) : null}
            </g>
          );
        }}
      />
    </ChartCard>
  );
}