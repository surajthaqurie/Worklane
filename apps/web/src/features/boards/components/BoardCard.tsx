'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, X, Loader2 } from 'lucide-react';
import { WorkItem } from '@/shared/types/work-items';
import { CardFields } from '@/shared/types/boards';
import { useToast } from '@/shared/hooks/useToast';
import { WorkItemTypeBadge } from '@/features/work-items/components/WorkItemBadge';

export interface BoardCardProps {
  item: WorkItem;
  cardFields: CardFields;
  onSelect: (item: WorkItem) => void;
  onRemove?: (item: WorkItem) => void;
  story?: { key: string; title: string };
}

export const BoardCard = React.memo(function BoardCard({
  item,
  cardFields,
  onSelect,
  onRemove,
  story,
}: BoardCardProps) {
  const { isItemPending } = useToast();
  const isPending = isItemPending(item.id);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
    disabled: isPending,
  });

  const showType = cardFields.showType !== false;
  const showPriority = cardFields.showPriority !== false;
  const showAssignee = cardFields.showAssignee !== false;
  const showPoints = cardFields.showPoints !== false;
  const showParent = cardFields.showParent !== false;

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect(item)}
      className={`group bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-card)] p-2.5 shadow-xs hover:shadow-md hover:border-[var(--border-strong)] cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-40 rotate-2' : ''
      } ${isPending ? 'opacity-70 border-[var(--brand-primary)]/50 ring-1 ring-[var(--brand-primary)]/30' : ''}`}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 text-[var(--brand-primary)] animate-spin shrink-0" />
        ) : (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-button)] text-[10px] font-semibold">
            <GripVertical className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors" />
          </span>
        )}

        {showType && <WorkItemTypeBadge type={item.type} />}

        <span className="text-[11px] font-medium text-[var(--text-secondary)]">{item.key}</span>

        {isPending && (
          <span className="text-[9px] font-medium text-[var(--brand-primary)] bg-[var(--bg-surface-selected)] px-1 rounded animate-pulse">
            Syncing...
          </span>
        )}

        {showParent && story && !isPending && (
          <span
            className="ml-auto text-[10px] font-medium text-[var(--text-muted)] truncate max-w-[90px]"
            title={story.title}
          >
            {story.key}
          </span>
        )}

        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item);
            }}
            className="p-0.5 text-[var(--text-muted)] hover:text-[var(--priority-high)] opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
            title="Remove from iteration"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className="text-[13px] font-medium text-[var(--text-primary)] leading-snug line-clamp-2 mb-2">
        {item.title}
      </p>

      <div className="flex items-center gap-2">
        {showPriority && (
          <>
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor:
                  item.priority === 'HIGH' || item.priority === 'URGENT'
                    ? 'var(--priority-high)'
                    : 'var(--priority-medium)',
              }}
            />
            <span className="text-[11px] text-[var(--text-muted)]">{item.priority}</span>
          </>
        )}

        {showPoints && item.points != null && (
          <span className="text-[11px] font-medium bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded-full ml-1 border border-[var(--border-subtle)]">
            {item.points} pts
          </span>
        )}

        {showAssignee && (
          <span className="ml-auto">
            {item.assignedTo ? (
              <span
                className="w-5 h-5 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[9px] text-[var(--text-primary)] font-medium"
                title={item.assignedTo}
              >
                {item.assignedTo.substring(0, 2).toUpperCase()}
              </span>
            ) : (
              <span className="w-5 h-5 rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-muted)] text-[9px] flex items-center justify-center">
                —
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
});
