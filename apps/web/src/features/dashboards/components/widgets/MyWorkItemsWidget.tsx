'use client';

import React from 'react';
import { ListTodo, CheckCircle2, Bookmark, Bug, Layers } from 'lucide-react';
import type { WidgetLayout } from '@/shared/types/dashboard';
import { WidgetCard } from '../WidgetCard';
import { useDashboardContext } from '../DashboardContext';

export function MyWorkItemsWidget({ widget }: { widget: WidgetLayout }) {
  const { data, isLoading, error, onOpenWorkItem } = useDashboardContext();
  const items = data?.myWorkItems ?? [];

  const isEmpty = !isLoading && !error && items.length === 0;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'BUG':
        return <Bug className="h-3.5 w-3.5 text-rose-500 shrink-0" />;
      case 'STORY':
        return <Bookmark className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
      default:
        return <Layers className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const isUrgent = priority === 'URGENT';
    const isHigh = priority === 'HIGH';
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
          isUrgent
            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
            : isHigh
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
              : 'bg-[var(--bg-surface-hover)] text-[var(--text-muted)]'
        }`}
      >
        {priority}
      </span>
    );
  };

  return (
    <WidgetCard
      widget={widget}
      title="My Work Items"
      description="Items currently assigned to you"
      icon={ListTodo}
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyIcon={CheckCircle2}
      emptyTitle="All caught up!"
      emptyDescription="No work items are currently assigned to you in this scope."
      headerActions={
        items.length > 0 ? (
          <span className="text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-surface-hover)] px-2 py-0.5 rounded-full">
            {items.length} items
          </span>
        ) : null
      }
    >
      <div className="divide-y divide-[var(--border-subtle)] -mx-1">
        {items.slice(0, 6).map((item) => (
          <div
            key={item.id}
            onClick={() => onOpenWorkItem?.(item.id)}
            className="flex items-center justify-between gap-3 py-2 px-2 hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              {getTypeIcon(item.type)}
              <span className="text-xs font-semibold text-[var(--text-muted)] shrink-0">
                {item.projectKey}-{item.seqNo}
              </span>
              <span className="truncate text-xs font-medium text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">
                {item.title}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {item.points !== null && item.points !== undefined && (
                <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface-hover)] px-1.5 py-0.5 rounded">
                  {item.points} pts
                </span>
              )}
              {getPriorityBadge(item.priority)}
              <span className="text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-surface-hover)] px-2 py-0.5 rounded-sm">
                {item.state}
              </span>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
