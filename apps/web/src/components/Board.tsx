'use client';

import React, { useState, useMemo } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
} from '@dnd-kit/core';
import { GripVertical, X } from 'lucide-react';
import { WorkItem } from '@/hooks/useWorkItems';
import { WorkItemState } from '@/hooks/useWorkItemStates';

type BoardProps = {
  items: WorkItem[];
  states: WorkItemState[];
  onStateChange: (itemId: string, stateKey: string) => void;
  onSelectItem: (item: WorkItem) => void;
  onRemoveItem?: (item: WorkItem) => void;
  storyByParentId?: Record<string, { key: string; title: string }>;
};

const TYPE_COLORS: Record<string, string> = {
  STORY: 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]',
  TASK: 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]',
  BUG: 'bg-[var(--priority-high)]/10 text-[var(--priority-high)]',
};

export function Board({
  items,
  states,
  onStateChange,
  onSelectItem,
  onRemoveItem,
  storyByParentId = {},
}: BoardProps) {
  const [optimistic, setOptimistic] = useState<Record<string, WorkItem>>({});

  const workingItems = useMemo(() => {
    const byId = new Map<string, WorkItem>();
    items.forEach((item) => byId.set(item.id, item));
    Object.values(optimistic).forEach((item) => {
      if (byId.has(item.id)) byId.set(item.id, item);
    });
    return [...byId.values()];
  }, [items, optimistic]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const overId = over.id.toString();
    if (!overId.startsWith('state-')) return;

    const stateKey = overId.slice('state-'.length);
    const item = active.data.current?.item as WorkItem | undefined;
    if (!item || item.state === stateKey) return;

    setOptimistic((prev) => ({
      ...prev,
      [item.id]: { ...item, state: stateKey },
    }));
    onStateChange(item.id, stateKey);
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 items-stretch">
        {states.map((state) => (
          <StateColumn
            key={state.id}
            state={state}
            items={workingItems.filter((w) => w.state === state.key)}
            onSelectItem={onSelectItem}
            onRemoveItem={onRemoveItem}
            storyByParentId={storyByParentId}
          />
        ))}
      </div>
    </DndContext>
  );
}

function StateColumn({
  state,
  items,
  onSelectItem,
  onRemoveItem,
  storyByParentId,
}: {
  state: WorkItemState;
  items: WorkItem[];
  onSelectItem: (item: WorkItem) => void;
  onRemoveItem?: (item: WorkItem) => void;
  storyByParentId: Record<string, { key: string; title: string }>;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `state-${state.key}`,
    data: { stateKey: state.key },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-[280px] min-w-[280px] max-h-full bg-[var(--bg-surface)] border rounded-[var(--radius-card)] transition-colors ${
        isOver
          ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20'
          : 'border-[var(--border-subtle)]'
      }`}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border-subtle)] rounded-t-[var(--radius-card)]"
        style={{ backgroundColor: `${state.color}14` }}
      >
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: state.color }} />
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">{state.name}</span>
        <span className="ml-auto text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-surface-hover)] px-1.5 py-0.5 rounded-full">
          {items.length}
        </span>
        {state.isDone && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sprint-completed)] bg-[var(--sprint-completed)]/10 px-1.5 py-0.5 rounded-full">
            Done
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-2 p-2 overflow-y-auto min-h-[120px]">
        {items.length === 0 && (
          <div className="flex-1 flex items-center justify-center border border-dashed border-[var(--border-default)] rounded-[var(--radius-card)] text-[12px] text-[var(--text-muted)] py-6">
            Drop items here
          </div>
        )}
        {items.map((item) => (
          <Card
            key={item.id}
            item={item}
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
  onSelect,
  onRemove,
  story,
}: {
  item: WorkItem;
  onSelect: (item: WorkItem) => void;
  onRemove?: (item: WorkItem) => void;
  story?: { key: string; title: string };
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect(item)}
      className={`group bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-card)] p-2.5 shadow-sm hover:shadow-md hover:border-[var(--border-strong)] cursor-pointer transition-all ${
        isDragging ? 'opacity-40 rotate-2' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-button)] text-[10px] font-semibold cursor-grab active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="w-3 h-3" />
        </span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-button)] text-[10px] font-semibold ${TYPE_COLORS[item.type] || TYPE_COLORS.TASK}`}>
          {item.type}
        </span>
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">{item.key}</span>
        {story && (
          <span className="ml-auto text-[10px] font-medium text-[var(--text-muted)] truncate max-w-[90px]" title={story.title}>
            {story.key}
          </span>
        )}
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item);
            }}
            className="p-0.5 text-[var(--text-muted)] hover:text-[var(--priority-high)] opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove from sprint"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className="text-[13px] font-medium text-[var(--text-primary)] leading-snug line-clamp-2 mb-2">
        {item.title}
      </p>

      <div className="flex items-center gap-2">
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
        <span className="ml-auto">
          {item.assignedTo ? (
            <span className="w-5 h-5 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[9px] text-[var(--text-primary)]" title={item.assignedTo}>
              {item.assignedTo.substring(0, 2).toUpperCase()}
            </span>
          ) : (
            <span className="w-5 h-5 rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-muted)] text-[9px] flex items-center justify-center">
              —
            </span>
          )}
        </span>
      </div>
    </div>
  );
}