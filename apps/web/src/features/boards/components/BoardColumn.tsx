'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { AlertCircle } from 'lucide-react';
import { WorkItem, WorkItemState } from '@/shared/types/work-items';
import { BoardColumn as BoardColumnConfig, CardFields } from '@/shared/types/boards';
import { BoardCard } from './BoardCard';

export interface BoardColumnProps {
  column: BoardColumnConfig;
  items: WorkItem[];
  states: WorkItemState[];
  cardFields: CardFields;
  onSelectItem: (item: WorkItem) => void;
  onRemoveItem?: (item: WorkItem) => void;
  storyByParentId: Record<string, { key: string; title: string }>;
}

export const BoardColumn = React.memo(function BoardColumn({
  column,
  items,
  states,
  cardFields,
  onSelectItem,
  onRemoveItem,
  storyByParentId,
}: BoardColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `col-${column.id}`,
    data: { columnId: column.id },
  });

  const primaryState = states.find((s) => column.mappedStates.includes(s.key));
  const headerColor = primaryState?.color || '#3B82F6';

  const wipLimit = column.wipLimit;
  const isWipExceeded = wipLimit != null && items.length > wipLimit;
  const isWipAtLimit = wipLimit != null && items.length === wipLimit;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-[290px] min-w-[290px] max-h-full bg-[var(--bg-surface)] border rounded-[var(--radius-card)] transition-all ${
        isWipExceeded
          ? 'border-[var(--priority-high)]/60 bg-[var(--priority-high)]/5'
          : isOver
          ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20'
          : 'border-[var(--border-subtle)]'
      }`}
    >
      {/* Column Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border-subtle)] rounded-t-[var(--radius-card)]"
        style={{ backgroundColor: `${headerColor}14` }}
      >
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: headerColor }} />
        <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate" title={column.name}>
          {column.name}
        </span>

        {/* Count & WIP Limit Badge */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              isWipExceeded
                ? 'bg-[var(--priority-high)] text-white animate-pulse'
                : isWipAtLimit
                ? 'bg-amber-500 text-white'
                : 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
            }`}
          >
            {wipLimit != null ? `${items.length} / ${wipLimit}` : items.length}
          </span>
        </div>
      </div>

      {/* WIP Limit Exceeded Warning Header */}
      {isWipExceeded && (
        <div className="bg-[var(--priority-high)]/10 text-[var(--priority-high)] px-3 py-1 text-[11px] font-medium flex items-center gap-1.5 border-b border-[var(--priority-high)]/20">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>WIP limit exceeded (Max {wipLimit})</span>
        </div>
      )}

      {/* Column Cards List */}
      <div className="flex-1 flex flex-col gap-2 p-2 overflow-y-auto min-h-[140px]">
        {items.length === 0 && (
          <div className="flex-1 flex items-center justify-center border border-dashed border-[var(--border-default)] rounded-[var(--radius-card)] text-[12px] text-[var(--text-muted)] py-8">
            Drop items here
          </div>
        )}
        {items.map((item) => (
          <BoardCard
            key={item.id}
            item={item}
            cardFields={cardFields}
            onSelect={onSelectItem}
            onRemove={onRemoveItem}
            story={item.parentId ? storyByParentId[item.parentId] : undefined}
          />
        ))}
      </div>
    </div>
  );
});
