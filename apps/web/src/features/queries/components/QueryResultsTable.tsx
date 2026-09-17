'use client';

import React from 'react';
import { WorkItem } from '@/shared/types/work-items';
import { WorkItemTypeBadge, WorkItemPriorityBadge } from '@/features/work-items/components/WorkItemBadge';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { Spinner } from '@/shared/components/ui/Spinner';

export interface QueryResultsTableProps {
  items: WorkItem[];
  isLoading?: boolean;
  onSelectItem: (item: WorkItem) => void;
}

export function QueryResultsTable({ items, isLoading, onSelectItem }: QueryResultsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState title="No query results" description="Run a query to see matching work items." />;
  }

  return (
    <div className="border border-[var(--border-subtle)] rounded-[var(--radius-card)] overflow-hidden bg-[var(--bg-surface)]">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] font-semibold text-[var(--text-secondary)] select-none">
              <th className="p-3 w-28">ID</th>
              <th className="p-3 w-28">Type</th>
              <th className="p-3">Title</th>
              <th className="p-3 w-28">State</th>
              <th className="p-3 w-28">Priority</th>
              <th className="p-3 w-20 text-center">Points</th>
              <th className="p-3 w-36">Assignee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-primary)]">
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => onSelectItem(item)}
                className="hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors"
              >
                <td className="p-3 font-mono text-[var(--text-secondary)]">{item.key}</td>
                <td className="p-3">
                  <WorkItemTypeBadge type={item.type} />
                </td>
                <td className="p-3 font-medium truncate max-w-md">{item.title}</td>
                <td className="p-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)]">
                    {item.state}
                  </span>
                </td>
                <td className="p-3">
                  <WorkItemPriorityBadge priority={item.priority} />
                </td>
                <td className="p-3 text-center text-[var(--text-secondary)] font-mono">
                  {item.points != null ? item.points : '—'}
                </td>
                <td className="p-3 text-[var(--text-secondary)] truncate">
                  {item.assignedToName || item.assignedTo || 'Unassigned'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
