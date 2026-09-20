'use client';

import React from 'react';
import { format } from 'date-fns';
import { Clock, User as UserIcon } from 'lucide-react';

export interface WorkItemHistoryEntry {
  id: string;
  user_name: string;
  user_avatar_url?: string | null;
  action: string;
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
}

export function WorkItemHistoryView({
  history = [],
  isLoading = false,
}: {
  history?: WorkItemHistoryEntry[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="py-6 text-center text-xs text-[var(--text-muted)] animate-pulse">
        Loading activity history...
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-[var(--text-muted)] italic">
        No history records found for this work item.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
        <Clock className="w-3.5 h-3.5" />
        <span>Audit Trail & Activity Log</span>
      </div>

      <div className="relative border-l border-[var(--border-subtle)] ml-3 pl-4 space-y-4">
        {history.map((entry) => (
          <div key={entry.id} className="relative group">
            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-[var(--bg-surface)]" />

            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
              <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                <UserIcon className="w-3 h-3 text-slate-400" />
                <span>{entry.user_name || 'System User'}</span>
              </div>
              <span className="text-[11px] text-[var(--text-tertiary)]">
                {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm')}
              </span>
            </div>

            <div className="text-xs text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] p-2.5 rounded-[var(--radius-card)] border border-[var(--border-subtle)]">
              <span className="font-semibold text-blue-600 dark:text-blue-400 mr-1.5 uppercase text-[10px]">
                {entry.action}
              </span>
              {entry.field && (
                <span className="text-[var(--text-secondary)] font-medium mr-1">
                  [{entry.field}]:
                </span>
              )}
              {entry.old_value && (
                <span className="line-through text-red-500/80 mr-1.5">
                  {entry.old_value}
                </span>
              )}
              {entry.new_value && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {entry.new_value}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
