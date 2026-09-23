'use client';

import React, { ReactNode } from 'react';
import { AnalyticsMeta } from '@/shared/types/analytics';

function MetaBadge({ meta }: { meta?: AnalyticsMeta }) {
  if (!meta) return null;
  const isSnapshot = meta.source === 'snapshot';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isSnapshot
          ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
          : 'bg-[var(--bg-surface-raised)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
      }`}
      title={
        isSnapshot && meta.computedAt
          ? `Computed at ${new Date(meta.computedAt).toLocaleString()}`
          : 'Computed live from history'
      }
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {isSnapshot ? 'Snapshot' : 'Live'}
    </span>
  );
}

export function ChartCard({
  title,
  subtitle,
  meta,
  actions,
  children,
  bodyClassName = 'px-4 pb-4',
}: {
  title: string;
  subtitle?: string;
  meta?: AnalyticsMeta;
  actions?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section
      className="flex flex-col rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden"
      aria-label={title}
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)] leading-tight">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)] truncate">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          <MetaBadge meta={meta} />
        </div>
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}