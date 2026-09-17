import React from 'react';
import { WorkItemType, WorkItemPriority } from '@/shared/types/work-items';
import { TYPE_LABELS, TYPE_BG_CLASSES, PRIORITY_LABELS, PRIORITY_COLORS } from '@/shared/utils/hierarchy';

export function WorkItemTypeBadge({ type }: { type: WorkItemType }) {
  const label = TYPE_LABELS[type] || type;
  const colorClass = TYPE_BG_CLASSES[type] || 'bg-gray-100 text-gray-800';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${colorClass}`}>
      {label}
    </span>
  );
}

export function WorkItemPriorityBadge({ priority }: { priority: WorkItemPriority }) {
  const label = PRIORITY_LABELS[priority] || priority;
  const colorClass = PRIORITY_COLORS[priority] || 'text-gray-500 bg-gray-500/10';

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${colorClass}`}>
      {label}
    </span>
  );
}
