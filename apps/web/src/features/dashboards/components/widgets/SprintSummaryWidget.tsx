'use client';

import React from 'react';
import { Clock, Calendar, CheckCircle2, ListTodo, Flame } from 'lucide-react';
import type { WidgetLayout } from '@/shared/types/dashboard';
import { WidgetCard } from '../WidgetCard';
import { useDashboardContext } from '../DashboardContext';

export function SprintSummaryWidget({ widget }: { widget: WidgetLayout }) {
  const { data, isLoading, error } = useDashboardContext();
  const summary = data?.sprintSummary;

  const isEmpty = !isLoading && !error && (!summary || !summary.iteration);

  const percentComplete = summary && summary.totalPoints > 0
    ? Math.round((summary.completedPoints / summary.totalPoints) * 100)
    : summary && summary.totalItems > 0
      ? Math.round((summary.completedItems / summary.totalItems) * 100)
      : 0;

  return (
    <WidgetCard
      widget={widget}
      title="Sprint Summary"
      description="Active iteration status and progress"
      icon={Clock}
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyTitle="No active sprint"
      emptyDescription="There is currently no iteration marked as active for this project."
    >
      {summary && summary.iteration && (
        <div className="space-y-4">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-[var(--text-primary)]">
                  {summary.iteration.name}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {summary.iteration.state}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-0.5">
                <Calendar className="h-3 w-3" />
                <span>
                  {new Date(summary.iteration.startDate).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  –{' '}
                  {new Date(summary.iteration.endDate).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-surface-hover)] text-xs font-medium text-[var(--text-secondary)]">
              <Clock className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              <span>
                {summary.daysRemaining === 0
                  ? 'Ends today'
                  : `${summary.daysRemaining} days left`}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-[var(--text-secondary)]">
                Effort Completed
              </span>
              <span className="font-semibold text-[var(--text-primary)]">
                {summary.completedPoints} / {summary.totalPoints} pts ({percentComplete}%)
              </span>
            </div>
            <div className="h-2.5 w-full bg-[var(--bg-surface-hover)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--brand-primary)] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>

          {/* Stat Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/40 p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-[var(--text-muted)]">
                <ListTodo className="h-3 w-3 text-slate-400" />
                To Do
              </div>
              <div className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                {summary.todoItems}
              </div>
            </div>

            <div className="rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/40 p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                <Clock className="h-3 w-3" />
                In Progress
              </div>
              <div className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {summary.inProgressItems}
              </div>
            </div>

            <div className="rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/40 p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Done
              </div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {summary.completedItems}
              </div>
            </div>

            <div className="rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/40 p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-[var(--text-muted)]">
                <Flame className="h-3 w-3 text-orange-500" />
                Total Points
              </div>
              <div className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                {summary.totalPoints}
              </div>
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
