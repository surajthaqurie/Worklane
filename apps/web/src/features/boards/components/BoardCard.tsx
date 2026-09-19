'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, X, Loader2 } from 'lucide-react';
import { WorkItem } from '@/shared/types/work-items';
import { CardFields } from '@/shared/types/boards';
import { ProjectMember } from '@/shared/types/projects';
import { useToast } from '@/shared/hooks/useToast';
import { WorkItemTypeBadge } from '@/features/work-items/components/WorkItemBadge';

export interface BoardCardProps {
  item: WorkItem;
  cardFields: CardFields;
  onSelect: (item: WorkItem) => void;
  onRemove?: (item: WorkItem) => void;
  story?: { key: string; title: string };
  childItems?: WorkItem[];
  members?: ProjectMember[];
  onAssign?: (itemId: string, userId: string | null) => void;
}

export const BoardCard = React.memo(function BoardCard({
  item,
  cardFields,
  onSelect,
  onRemove,
  story,
  childItems = [],
  members = [],
  onAssign,
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

  // Resolve assigned user display name and initials
  const assignedMember = members.find((m) => m.userId === item.assignedTo);
  const assigneeName = item.assignedToName || assignedMember?.userName || (item.assignedTo ? 'Assigned' : 'Unassigned');
  const assigneeInitials = assigneeName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || '?';

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect(item)}
      className={`group bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-card)] p-2.5 shadow-xs hover:shadow-md hover:border-[var(--border-strong)] transition-all cursor-pointer ${
        isDragging ? 'opacity-40 rotate-2' : ''
      } ${isPending ? 'opacity-70 border-[var(--brand-primary)]/50 ring-1 ring-[var(--brand-primary)]/30' : ''}`}
    >
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 text-[var(--brand-primary)] animate-spin shrink-0" />
        ) : (
          <span
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center p-0.5 rounded-[var(--radius-button)] text-[10px] font-semibold cursor-grab active:cursor-grabbing hover:bg-[var(--bg-surface-hover)] transition-colors"
            title="Drag handle — drag to move item"
          >
            <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors" />
          </span>
        )}

        {showType && <WorkItemTypeBadge type={item.type} />}

        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{item.key}</span>

        {isPending && (
          <span className="text-[9px] font-medium text-[var(--brand-primary)] bg-[var(--bg-surface-selected)] px-1 rounded animate-pulse">
            Syncing...
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

      {/* Parent Story Banner */}
      {showParent && story && !isPending && (
        <div
          className="w-full flex items-center gap-1.5 text-[10px] font-medium text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-2 py-1 rounded-[var(--radius-button)] border border-[var(--brand-primary)]/20 truncate mb-1.5"
          title={`Parent Story: [${story.key}] ${story.title}`}
        >
          <span className="shrink-0 font-mono text-[9px] font-bold bg-[var(--brand-primary)]/20 px-1 rounded">
            {story.key}
          </span>
          <span className="truncate whitespace-pre-line">{story.title}</span>
        </div>
      )}

      {/* Work Item Title */}
      <p
        className="text-[13px] font-medium text-[var(--text-primary)] leading-snug line-clamp-3 mb-2 break-words whitespace-pre-wrap"
        title={item.title}
      >
        {item.title}
      </p>

      {/* Child Tasks & Bugs list summary */}
      {childItems && childItems.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap my-1.5 pt-1.5 border-t border-[var(--border-subtle)] text-[10px]">
          <span className="text-[var(--text-muted)] font-medium shrink-0">Sub-items:</span>
          {childItems.slice(0, 3).map((child) => (
            <span
              key={child.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-medium max-w-[120px] truncate"
              title={`[${child.type}] ${child.key} - ${child.title} (${child.state})`}
            >
              <span className="font-mono font-semibold text-[9px] text-[var(--brand-primary)]">{child.key}</span>
              <span className="truncate text-[9px] whitespace-pre-line">{child.title}</span>
            </span>
          ))}
          {childItems.length > 3 && (
            <span className="text-[9px] text-[var(--text-muted)] font-semibold">
              +{childItems.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        {showPriority && (
          <div className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor:
                  item.priority === 'HIGH' || item.priority === 'URGENT'
                    ? 'var(--priority-high)'
                    : item.priority === 'MEDIUM'
                    ? 'var(--priority-medium)'
                    : 'var(--priority-low)',
              }}
            />
            <span className="text-[11px] text-[var(--text-muted)] capitalize">{item.priority.toLowerCase()}</span>
          </div>
        )}

        {showPoints && item.points != null && (
          <span className="text-[11px] font-medium bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded-full border border-[var(--border-subtle)]">
            {item.points} pts
          </span>
        )}

        {showAssignee && (
          <div className="ml-auto relative shrink-0" onClick={(e) => e.stopPropagation()}>
            <select
              value={item.assignedTo ?? ''}
              onChange={(e) => onAssign && onAssign(item.id, e.target.value || null)}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10 text-[11px]"
              title={`Assigned to: ${assigneeName}. Click to reassign.`}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userName} ({m.userEmail || m.role})
                </option>
              ))}
            </select>
            {item.assignedTo ? (
              <span
                className="w-6 h-6 rounded-full bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30 flex items-center justify-center text-[10px] font-bold shadow-xs hover:ring-2 hover:ring-[var(--brand-primary)]/30 transition-all cursor-pointer"
                title={`Assigned to: ${assigneeName}`}
              >
                {assigneeInitials}
              </span>
            ) : (
              <span
                className="w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] text-[10px] flex items-center justify-center cursor-pointer transition-colors"
                title="Unassigned — Click to assign"
              >
                +
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
