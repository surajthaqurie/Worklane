'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';
import type { WidgetLayout } from '@/shared/types/dashboard';
import { WidgetCard } from '../WidgetCard';
import { useDashboardContext } from '../DashboardContext';

export function VelocityWidget({ widget }: { widget: WidgetLayout }) {
  const { data, isLoading, error } = useDashboardContext();
  const velocity = data?.velocity;
  const iterations = velocity?.iterations ?? [];

  const isEmpty = !isLoading && !error && (!velocity || iterations.length === 0);

  const maxPoints = Math.max(
    ...iterations.flatMap((it) => [it.committedPoints, it.completedPoints]),
    1,
  );

  return (
    <WidgetCard
      widget={widget}
      title="Velocity"
      description="Historical sprint throughput"
      icon={BarChart3}
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyTitle="No velocity history"
      emptyDescription="Completed sprint history will accumulate here to project team throughput."
    >
      {velocity && !isEmpty && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--text-secondary)]">
              Last {iterations.length} Sprints
            </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              Avg: {Math.round(velocity.summary?.avgCompletedPoints ?? 0)} pts / sprint
            </span>
          </div>

          {/* Bar Chart */}
          <div className="space-y-2 pt-1">
            {iterations.slice(-4).map((it) => {
              const committedPct = Math.round((it.committedPoints / maxPoints) * 100);
              const completedPct = Math.round((it.completedPoints / maxPoints) * 100);

              return (
                <div key={it.iterationId} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[120px] font-medium text-[var(--text-primary)]">
                      {it.name}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {it.completedPoints} / {it.committedPoints} pts
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    {/* Committed Bar */}
                    <div className="h-1.5 w-full bg-[var(--bg-surface-hover)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-300 dark:bg-slate-600 rounded-full"
                        style={{ width: `${committedPct}%` }}
                        title={`Committed: ${it.committedPoints} pts`}
                      />
                    </div>
                    {/* Completed Bar */}
                    <div className="h-2 w-full bg-[var(--bg-surface-hover)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${completedPct}%` }}
                        title={`Completed: ${it.completedPoints} pts`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-4 text-[11px] text-[var(--text-muted)] pt-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-xs bg-slate-300 dark:bg-slate-600" />
              <span>Committed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-xs bg-emerald-500" />
              <span>Completed</span>
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
