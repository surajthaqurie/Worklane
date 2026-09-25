'use client';

import React from 'react';
import { Activity, Clock } from 'lucide-react';
import type { WidgetLayout } from '@/shared/types/dashboard';
import { WidgetCard } from '../WidgetCard';
import { useDashboardContext } from '../DashboardContext';

export function ActivityWidget({ widget }: { widget: WidgetLayout }) {
  const { data, isLoading, error } = useDashboardContext();
  const activities = data?.activity ?? [];

  const isEmpty = !isLoading && !error && activities.length === 0;

  const formatAction = (action: string, field: string | null, oldValue: string | null, newValue: string | null) => {
    switch (action) {
      case 'STATE_CHANGED':
        return `changed state from ${oldValue || '—'} to ${newValue || '—'}`;
      case 'ASSIGNED':
        return `assigned to ${newValue || 'unassigned'}`;
      case 'CREATED':
        return 'created work item';
      case 'FIELD_UPDATED':
        return `updated ${field || 'field'}`;
      default:
        return action.toLowerCase().replace(/_/g, ' ');
    }
  };

  const formatRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <WidgetCard
      widget={widget}
      title="Activity"
      description="Recent updates and history stream"
      icon={Activity}
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyTitle="No recent activity"
      emptyDescription="Work item modifications and status updates will be logged here."
    >
      <div className="space-y-3 -mx-1">
        {activities.slice(0, 6).map((item) => (
          <div key={item.id} className="flex items-start gap-2.5 text-xs py-1 px-2 rounded-sm hover:bg-[var(--bg-surface-hover)] transition-colors">
            {/* User Avatar / Initials */}
            <div className="h-6 w-6 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-semibold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
              {item.userName ? item.userName.charAt(0).toUpperCase() : 'U'}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[var(--text-primary)] leading-tight">
                <span className="font-semibold">{item.userName}</span>{' '}
                <span className="text-[var(--text-secondary)]">
                  {formatAction(item.action, item.field, item.oldValue, item.newValue)}
                </span>{' '}
                <span className="font-medium text-[var(--text-primary)]">
                  #{item.workItemSeq} {item.workItemTitle}
                </span>
              </p>

              <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] mt-1">
                <Clock className="h-2.5 w-2.5" />
                <span>{formatRelativeTime(item.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
