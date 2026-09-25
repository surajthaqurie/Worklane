'use client';

import React, { ReactNode } from 'react';
import { Calendar, BarChart2 } from 'lucide-react';
import { AnalyticsMeta } from '@/shared/types/analytics';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { ErrorState } from '@/shared/components/ui/ErrorState';

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

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  meta?: AnalyticsMeta;
  dateRange?: string | ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  ariaLabel?: string;
  height?: number;
}

export function ChartCard({
  title,
  subtitle,
  meta,
  dateRange,
  filters,
  actions,
  isLoading = false,
  error = null,
  onRetry,
  isEmpty = false,
  emptyTitle,
  emptyMessage = 'There is no recorded activity matching the selected window and filters.',
  emptyAction,
  children,
  bodyClassName = 'px-4 pb-4',
  ariaLabel,
  height = 280,
}: ChartCardProps) {
  return (
    <section
      className="flex flex-col rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden"
      aria-label={ariaLabel || title}
    >
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-[var(--border-subtle)]/40">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)] leading-tight">{title}</h2>
            {dateRange ? (
              <span className="inline-flex items-center gap-1 rounded bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                <Calendar className="w-3 h-3 text-[var(--text-muted)]" aria-hidden="true" />
                {dateRange}
              </span>
            ) : null}
            <MetaBadge meta={meta} />
          </div>
          {subtitle ? (
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)] truncate">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {filters}
          {actions}
        </div>
      </header>

      <div className={bodyClassName}>
        {isLoading ? (
          <div
            className="flex flex-col justify-center items-center gap-3 p-8 animate-pulse"
            style={{ minHeight: height }}
            role="status"
            aria-label={`Loading ${title}`}
          >
            <div className="w-full h-4 bg-[var(--bg-surface-raised)] rounded mb-4" />
            <div className="w-full flex-1 bg-[var(--bg-surface-raised)] rounded-md" style={{ minHeight: height - 60 }} />
            <span className="sr-only">Loading {title}...</span>
          </div>
        ) : error ? (
          <div className="py-4">
            <ErrorState
              error={error}
              onRetry={onRetry}
              title={`Failed to load ${title}`}
            />
          </div>
        ) : isEmpty ? (
          <div className="py-4">
            <EmptyState
              icon={<BarChart2 className="w-6 h-6" />}
              title={emptyTitle ?? `No ${title} data`}
              description={emptyMessage}
              action={emptyAction}
            />
          </div>
        ) : (
          <div className="pt-3">{children}</div>
        )}
      </div>
    </section>
  );
}