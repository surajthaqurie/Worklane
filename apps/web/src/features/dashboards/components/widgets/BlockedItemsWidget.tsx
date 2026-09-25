'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { WidgetLayout } from '@/shared/types/dashboard';
import { WidgetCard } from '../WidgetCard';
import { useDashboardContext } from '../DashboardContext';

export function BlockedItemsWidget({ widget }: { widget: WidgetLayout }) {
  const { data, isLoading, error, onOpenWorkItem } = useDashboardContext();
  const blockedItems = data?.blockedItems ?? [];

  const isEmpty = !isLoading && !error && blockedItems.length === 0;

  return (
    <WidgetCard
      widget={widget}
      title="Blocked Items"
      description="Items waiting on dependencies or issues"
      icon={AlertTriangle}
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyIcon={CheckCircle2}
      emptyTitle="No blocked items"
      emptyDescription="Work is flowing smoothly without unresolved dependency bottlenecks."
      headerActions={
        blockedItems.length > 0 ? (
          <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-full">
            {blockedItems.length} blocked
          </span>
        ) : null
      }
    >
      <div className="divide-y divide-[var(--border-subtle)] -mx-1">
        {blockedItems.slice(0, 5).map((item) => (
          <div
            key={item.id}
            onClick={() => onOpenWorkItem?.(item.id)}
            className="flex flex-col gap-1 py-2 px-2 hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] cursor-pointer transition-colors group"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span className="text-xs font-semibold text-[var(--text-muted)] shrink-0">
                  {item.projectKey}-{item.seqNo}
                </span>
                <span className="truncate text-xs font-medium text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">
                  {item.title}
                </span>
              </div>
              <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 px-1.5 py-0.5 rounded shrink-0">
                {item.priority}
              </span>
            </div>

            <div className="flex items-center gap-2 pl-5 text-[11px] text-[var(--text-muted)]">
              <span className="truncate text-amber-700 dark:text-amber-400">
                {item.reason}
              </span>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
