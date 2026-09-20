import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronRight, ChevronDown, Plus, Loader2 } from 'lucide-react';
import { BacklogItem } from '@/shared/types/backlogs';
import { WorkItemState, WorkItem, WorkItemType, WorkItemRollup } from '@/shared/types/work-items';
import { Iteration } from '@/shared/types/iterations';
import { ProjectMember } from '@/shared/types/projects';
import { WorkItemTypeBadge, WorkItemPriorityBadge } from '@/features/work-items/components/WorkItemBadge';
import { PARENT_TYPES } from '@/shared/utils/hierarchy';
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
  allWorkItems?: WorkItem[];
  rollup?: WorkItemRollup;
  onToggleExpand: (id: string) => void;
  onSelectRow: (id: string, e: React.MouseEvent) => void;
  onToggleSelectRow: (id: string) => void;
  onOpenDrawer: (item: BacklogItem) => void;
  onAddChild: (parentItem: BacklogItem) => void;
  onStartEditing: (item: BacklogItem) => void;
  onCancelEditing: () => void;
  onSaveEditing: (item: BacklogItem) => void;
  onDraftChange: (field: keyof BacklogItem, value: unknown) => void;
  onUpdateAssignee: (id: string, userId: string | null) => void;
  onUpdateState: (id: string, state: string) => void;
  onUpdateParent?: (id: string, parentId: string | null) => void;
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
  members,
  allWorkItems = [],
  rollup,
  onToggleExpand,
  onSelectRow,
  onToggleSelectRow,
  onOpenDrawer,
  onAddChild,
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onDraftChange,
  onUpdateAssignee,
  onUpdateState,
  onUpdateParent,
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

  const allowedParentTypes = PARENT_TYPES[item.type as WorkItemType] || [];
  const validParents = allWorkItems.filter(
    (w) => w.id !== item.id && allowedParentTypes.includes(w.type as WorkItemType)
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => onSelectRow(item.id, e)}
      className={`group flex items-center min-h-[40px] py-1 border-b border-[var(--border-subtle)] text-xs transition-colors select-none ${
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
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelectRow(item.id);
          }}
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
          <textarea
            value={editDraft.title ?? item.title}
            onChange={(e) => onDraftChange('title', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSaveEditing(item);
              }
              if (e.key === 'Escape') onCancelEditing();
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            rows={Math.min(4, Math.max(1, (editDraft.title ?? item.title).split('\n').length))}
            className="w-full text-xs font-medium bg-[var(--bg-surface)] border border-[var(--border-focus)] rounded px-2 py-1 text-[var(--text-primary)] outline-none resize-y whitespace-pre-wrap leading-snug"
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
            className="font-medium text-[var(--text-primary)] cursor-pointer hover:text-[var(--brand-primary)] whitespace-pre-wrap break-words line-clamp-2"
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
            if (isEditing) {
              onDraftChange('state', e.target.value);
            } else {
              onUpdateState(item.id, e.target.value);
            }
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

      {/* Severity */}
      <div className="w-20 shrink-0 px-2 text-[11px]">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
          item.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-600 border border-red-500/30' :
          item.severity === 'HIGH' ? 'bg-orange-500/10 text-orange-600 border border-orange-500/30' :
          'text-[var(--text-secondary)]'
        }`}>
          {item.severity || 'MEDIUM'}
        </span>
      </div>

      {/* Points & Work */}
      <div className="w-24 shrink-0 px-2 text-center text-[11px] text-[var(--text-secondary)]">
        {rollup && rollup.descendantCount > 0 ? (
          <div className="flex flex-col items-center" title={`${rollup.completedCount}/${rollup.descendantCount} items completed (${rollup.completionPercentage}%)`}>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {rollup.totalPoints > 0 ? `${rollup.completedPoints}/${rollup.totalPoints} pts` : `${rollup.completedCount}/${rollup.descendantCount} done`}
            </span>
            <div className="w-14 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-0.5">
              <div
                className="bg-indigo-600 dark:bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${rollup.completionPercentage}%` }}
              />
            </div>
          </div>
        ) : item.points != null ? (
          `${item.points} pts`
        ) : item.remainingWork != null ? (
          `${item.remainingWork}h`
        ) : (
          '—'
        )}
      </div>

      {/* Assignee */}
      <div className="w-32 shrink-0 px-2">
        <select
          value={isEditing ? (editDraft.assignedTo ?? item.assignedTo ?? '') : (item.assignedTo ?? '')}
          onChange={(e) => {
            e.stopPropagation();
            const val = e.target.value || null;
            if (isEditing) {
              onDraftChange('assignedTo', val);
            } else {
              onUpdateAssignee(item.id, val);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-full text-[11px] bg-transparent border-none outline-none cursor-pointer text-[var(--text-primary)] truncate"
        >
          <option value="" className="text-[var(--text-muted)] bg-[var(--bg-surface)]">
            Unassigned
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.userId} className="text-[var(--text-primary)] bg-[var(--bg-surface)]">
              {m.userName}
            </option>
          ))}
        </select>
      </div>

      {/* Parent Item */}
      <div className="w-36 shrink-0 px-2">
        <select
          value={isEditing ? (editDraft.parentId ?? item.parentId ?? '') : (item.parentId ?? '')}
          onChange={(e) => {
            e.stopPropagation();
            const val = e.target.value || null;
            if (isEditing) {
              onDraftChange('parentId', val);
            } else if (onUpdateParent) {
              onUpdateParent(item.id, val);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={allowedParentTypes.length === 0}
          className="w-full text-[11px] bg-transparent border-none outline-none cursor-pointer text-[var(--text-primary)] truncate disabled:opacity-40"
        >
          <option value="" className="text-[var(--text-muted)] bg-[var(--bg-surface)]">
            {allowedParentTypes.length === 0 ? 'No parent allowed' : 'No Parent'}
          </option>
          {validParents.map((p) => (
            <option key={p.id} value={p.id} className="text-[var(--text-primary)] bg-[var(--bg-surface)]">
              [{p.key}] {p.title}
            </option>
          ))}
        </select>
      </div>

      {/* Iteration */}
      <div className="w-32 shrink-0 px-2 truncate text-[11px] text-[var(--text-secondary)]">
        {iterations.find((it) => it.id === item.iterationId)?.name || 'Backlog'}
      </div>
    </div>
  );
}
