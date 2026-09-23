'use client';

import React from 'react';
import { AnalyticsSummaryDto } from '@/shared/types/analytics';
import { formatHoursCompact } from '../charts/model';

const FLOW_LABELS: Array<{ key: keyof AnalyticsSummaryDto['flow']; label: string; color: string }> = [
  { key: 'proposed', label: 'Proposed', color: '#9ca3af' },
  { key: 'inProgress', label: 'In Progress', color: '#3b82f6' },
  { key: 'resolved', label: 'Resolved', color: '#f59e0b' },
  { key: 'completed', label: 'Completed', color: '#10b981' },
];

export function SummaryCards({ summary }: { summary: AnalyticsSummaryDto }) {
  return (
    <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" aria-label="Analytics summary">
      <StatCard label="Avg velocity" value={`${summary.velocity.avgCompletedPoints} pts`} hint={`${summary.velocity.iterations} sprints in range`} />
      <StatCard label="Cycle median" value={formatHoursCompact(summary.cycleTime.medianHours)} hint={`${summary.cycleTime.count} items`} />
      <StatCard label="Lead median" value={formatHoursCompact(summary.leadTime.medianHours)} hint={`${summary.leadTime.count} items`} />
      <StatCard
        label="Completed in range"
        value={String(summary.completedInRange)}
        hint={`${summary.createdInRange} created`}
      />
      {FLOW_LABELS.map((f) => (
        <StatCard
          key={f.key}
          label={f.label}
          value={String(summary.flow[f.key])}
          hint="in trailing bucket"
          dot={f.color}
        />
      ))}
      <StatCard label="Last velocity" value={`${summary.velocity.lastCompletedPoints} pts`} hint="last sprint" />
    </dl>
  );
}

function StatCard({
  label,
  value,
  hint,
  dot,
}: {
  label: string;
  value: string;
  hint?: string;
  dot?: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
        {dot ? <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: dot }} aria-hidden="true" /> : null}
        {label}
      </dt>
      <dd className="mt-1 text-[20px] font-semibold text-[var(--text-primary)] tabular-nums">{value}</dd>
      {hint ? <dd className="text-[12px] text-[var(--text-muted)] mt-0.5">{hint}</dd> : null}
    </div>
  );
}