'use client';

import React from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
} from '@dnd-kit/core';
import { GripVertical, X, Loader2, AlertCircle } from 'lucide-react';
import { WorkItem } from '@/hooks/useWorkItems';
import { WorkItemState } from '@/hooks/useWorkItemStates';
import { BoardConfig, BoardColumn as BoardColumnConfig, CardFields } from '@/hooks/useBoards';
import { useToast } from '@/components/Toast';

type BoardProps = {
  items: WorkItem[];
  states: WorkItemState[];
  board?: BoardConfig | null;
  onStateChange: (itemId: string, stateKey: string) => void;
  onSelectItem: (item: WorkItem) => void;
  onRemoveItem?: (item: WorkItem) => void;
  storyByParentId?: Record<string, { key: string; title: string }>;
  disableInternalDnd?: boolean;
};

const TYPE_COLORS: Record<string, string> = {
  EPIC: 'bg-[#9333ea]/10 text-[#9333ea]',
  FEATURE: 'bg-[#ea580c]/10 text-[#ea580c]',
  STORY: 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]',
  TASK: 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]',
  BUG: 'bg-[var(--priority-high)]/10 text-[var(--priority-high)]',
};

export function Board({
  items,
  states,
  board,
  onStateChange,
  onSelectItem,
  onRemoveItem,
  storyByParentId = {},
  disableInternalDnd = false,
}: BoardProps) {
  // If board config exists, use columns from board; otherwise create 1-to-1 fallback columns from states
  const columns: BoardColumnConfig[] = React.useMemo(() => {
    if (board?.columns && board.columns.length > 0) {
      return board.columns;
    }
    return states.map((s, idx) => ({
      id: `col-${s.key}`,
      name: s.name,
      mappedStates: [s.key],
      wipLimit: idx === 1 ? 5 : null,
    }));
  }, [board, states]);

  const cardFields: CardFields = React.useMemo(() => {
    return (
      board?.cardFields || {
        showType: true,
        showPriority: true,
        showAssignee: true,
        showPoints: true,
        showParent: true,
        showTags: true,
      }
    );
  }, [board]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const overId = over.id.toString();
    if (!overId.startsWith('col-')) return;

    const columnId = overId.slice('col-'.length);
    const targetColumn = columns.find((c) => c.id === columnId);
    if (!targetColumn || targetColumn.mappedStates.length === 0) return;

    const targetStateKey = targetColumn.mappedStates[0];
    const item = active.data.current?.item as WorkItem | undefined;
    if (!item || item.state === targetStateKey) return;

    onStateChange(item.id, targetStateKey);
  };

  const content = (
    <div className="flex gap-4 overflow-x-auto pb-4 items-stretch h-full w-full min-h-[400px]">
      {columns.map((col) => {
        const columnItems = items.filter((w) => col.mappedStates.includes(w.state));
        return (
          <ColumnView
            key={col.id}
            column={col}
            items={columnItems}
            states={states}
            cardFields={cardFields}
            onSelectItem={onSelectItem}
            onRemoveItem={onRemoveItem}
            storyByParentId={storyByParentId}
          />
        );
      })}
    </div>
  );

  if (disableInternalDnd) {
    return content;
  }

  return <DndContext onDragEnd={handleDragEnd}>{content}</DndContext>;
}

function ColumnView({
  column,
  items,
  states,
  cardFields,
  onSelectItem,
  onRemoveItem,
  storyByParentId,
}: {
  column: BoardColumnConfig;
  items: WorkItem[];
  states: WorkItemState[];
  cardFields: CardFields;
  onSelectItem: (item: WorkItem) => void;
  onRemoveItem?: (item: WorkItem) => void;
  storyByParentId: Record<string, { key: string; title: string }>;
}) {
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
          <Card
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
}

function Card({
  item,
  cardFields,
  onSelect,
  onRemove,
  story,
}: {
  item: WorkItem;
  cardFields: CardFields;
  onSelect: (item: WorkItem) => void;
  onRemove?: (item: WorkItem) => void;
  story?: { key: string; title: string };
}) {
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

        {showType && (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-button)] text-[10px] font-semibold ${
              TYPE_COLORS[item.type] || TYPE_COLORS.TASK
            }`}
          >
            {item.type}
          </span>
        )}

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
                className="w-5 h-5 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[9px] text-[var(--text-primary)]"
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
}