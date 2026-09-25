'use client';

import React from 'react';
import { Users } from 'lucide-react';
import type { WidgetLayout } from '@/shared/types/dashboard';
import { WidgetCard } from '../WidgetCard';
import { useDashboardContext } from '../DashboardContext';

export function TeamProgressWidget({ widget }: { widget: WidgetLayout }) {
  const { data, isLoading, error } = useDashboardContext();
  const members = data?.teamProgress ?? [];

  const isEmpty = !isLoading && !error && members.length === 0;

  return (
    <WidgetCard
      widget={widget}
      title="Team Progress"
      description="Member workload and throughput"
      icon={Users}
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyTitle="No team progress"
      emptyDescription="Member workload and completion statistics will appear here."
      headerActions={
        members.length > 0 ? (
          <span className="text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-surface-hover)] px-2 py-0.5 rounded-full">
            {members.length} members
          </span>
        ) : null
      }
    >
      <div className="space-y-3 -mx-1">
        {members.slice(0, 5).map((member) => {
          const totalAssigned = member.assignedCount || 1;
          const completedPct = Math.round((member.doneCount / totalAssigned) * 100);

          return (
            <div key={member.userId} className="space-y-1.5 p-2 rounded-sm hover:bg-[var(--bg-surface-hover)] transition-colors">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="h-5 w-5 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-semibold flex items-center justify-center text-[10px] shrink-0">
                    {member.name ? member.name.charAt(0).toUpperCase() : 'M'}
                  </div>
                  <span className="truncate font-medium text-[var(--text-primary)]">
                    {member.name}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0 text-[11px] text-[var(--text-muted)]">
                  <span>
                    <strong className="text-amber-600 dark:text-amber-400">{member.inProgressCount}</strong> in progress
                  </span>
                  <span>·</span>
                  <span>
                    <strong className="text-emerald-600 dark:text-emerald-400">{member.doneCount}</strong> done
                  </span>
                  {member.totalPoints > 0 && (
                    <>
                      <span>·</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {member.totalPoints} pts
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full bg-[var(--bg-surface-hover)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${completedPct}%` }}
                  title={`${completedPct}% complete`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
