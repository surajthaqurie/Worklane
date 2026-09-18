'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronRight, ChevronDown, Plus, Loader2 } from 'lucide-react';
import { BacklogItem } from '@/shared/types/backlogs';
import { WorkItemState } from '@/shared/types/work-items';
import { Iteration } from '@/shared/types/iterations';
import { ProjectMember } from '@/shared/types/projects';
import { WorkItemTypeBadge, WorkItemPriorityBadge } from '@/features/work-items/components/WorkItemBadge';
import { useToast } from '@/shared/hooks/useToast';

export interface BacklogRowProps {
  item: BacklogItem;
  depth: number;
  isExpanded: boolean;
  isLoadingChildren?: boolean;
  isSelected: boolean;
  isEditing: boolean;
  editDraft: Partial<BacklogItem>;
  states: WorkItemState[];
  iterations: Iteration[];
  members: ProjectMember[];
  onToggleExpand: (id: string) => void;
  onSelectRow: (id: string, e: React.MouseEvent) => void;
  onOpenDrawer: (item: BacklogItem) => void;
  onAddChild: (parentItem: BacklogItem) => void;
  onStartEditing: (item: BacklogItem) => void;
  onCancelEditing: () => void;
  onSaveEditing: (item: BacklogItem) => void;
  onDraftChange: (field: keyof BacklogItem, value: unknown) => void;
}

const INDENT_PX = 20;

export function BacklogRow({
  item,
  depth,
  isExpanded,
  isLoadingChildren,
  isSelected,
  isEditing,
  editDraft,
  states,
  iterations,
  onToggleExpand,
  onSelectRow,
  onOpenDrawer,
  onAddChild,
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onDraftChange,
}: BacklogRowProps) {
  const { isItemPending } = useToast();
  const isPending = isItemPending(item.id);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: isPending || isEditing,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const currentState = states.find((s) => s.key === (isEditing ? editDraft.state : item.state));
  const stateColor = currentState?.color || '#94A3B8';

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => onSelectRow(item.id, e)}
      className={`group flex items-center h-10 border-b border-[var(--border-subtle)] text-xs transition-colors select-none ${
        isDragging
          ? 'opacity-30 bg-[var(--bg-surface-hover)]'
          : isSelected
          ? 'bg-[var(--bg-surface-selected)]'
          : isPending
          ? 'opacity-70 bg-[var(--bg-surface-hover)]/50'
          : 'hover:bg-[var(--bg-surface-hover)] bg-[var(--bg-surface)]'
      }`}
    >
      {/* Drag Handle & Checkbox */}
      <div className="flex items-center gap-1.5 px-2 shrink-0">
        <button
          type="button"
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-[var(--border-default)] accent-[var(--brand-primary)] cursor-pointer"
        />
      </div>

      {/* Indentation & Tree Expand Toggle */}
      <div className="flex items-center shrink-0" style={{ paddingLeft: `${depth * INDENT_PX}px` }}>
        {item.hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(item.id);
            }}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded transition-colors"
          >
            {isLoadingChildren ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--brand-primary)]" />
            ) : isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}
      </div>

      {/* Work Item Type & Key */}
      <div className="flex items-center gap-2 px-2 w-44 shrink-0 min-w-0">
        <WorkItemTypeBadge type={item.type} />
        <span
          onClick={(e) => {
            e.stopPropagation();
            onOpenDrawer(item);
          }}
          className="font-mono text-[11px] text-[var(--text-secondary)] hover:text-[var(--brand-primary)] hover:underline cursor-pointer truncate"
        >
          {item.key}
        </span>
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0 px-2 flex items-center gap-2">
        {isEditing ? (
          <input
            type="text"
            value={editDraft.title ?? item.title}
            onChange={(e) => onDraftChange('title', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEditing(item);
              if (e.key === 'Escape') onCancelEditing();
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="w-full text-xs font-medium bg-[var(--bg-surface)] border border-[var(--border-focus)] rounded px-2 py-0.5 text-[var(--text-primary)] outline-none"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartEditing(item);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenDrawer(item);
            }}
            className="font-medium text-[var(--text-primary)] truncate cursor-pointer hover:text-[var(--brand-primary)]"
          >
            {item.title}
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild(item);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-opacity"
          title="Add child item"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* State */}
      <div className="w-28 shrink-0 px-2">
        <select
          value={isEditing ? editDraft.state ?? item.state : item.state}
          onChange={(e) => {
            e.stopPropagation();
            onDraftChange('state', e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-full text-[11px] font-medium bg-transparent border-none outline-none cursor-pointer text-[var(--text-primary)]"
          style={{ color: stateColor }}
        >
          {states.map((s) => (
            <option key={s.id} value={s.key} className="text-[var(--text-primary)] bg-[var(--bg-surface)]">
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Priority */}
      <div className="w-24 shrink-0 px-2">
        <WorkItemPriorityBadge priority={item.priority} />
      </div>

      {/* Points */}
      <div className="w-16 shrink-0 px-2 text-center text-[11px] text-[var(--text-secondary)]">
        {item.points != null ? `${item.points} pts` : '—'}
      </div>

      {/* Assignee */}
      <div className="w-32 shrink-0 px-2 truncate text-[11px] text-[var(--text-secondary)]">
        {item.assignedToName || 'Unassigned'}
      </div>

      {/* Iteration */}
      <div className="w-32 shrink-0 px-2 truncate text-[11px] text-[var(--text-secondary)]">
        {iterations.find((it) => it.id === item.iterationId)?.name || 'Backlog'}
      </div>
    </div>
  );
}
