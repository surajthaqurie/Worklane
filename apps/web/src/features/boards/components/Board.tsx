'use client';

import React, { useMemo } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { WorkItem, WorkItemState } from '@/shared/types/work-items';
import { BoardConfig, BoardColumn as BoardColumnConfig, CardFields } from '@/shared/types/boards';
import { BoardColumn } from './BoardColumn';

export interface BoardProps {
  items: WorkItem[];
  states: WorkItemState[];
  board?: BoardConfig | null;
  onStateChange: (itemId: string, stateKey: string) => void;
  onSelectItem: (item: WorkItem) => void;
  onRemoveItem?: (item: WorkItem) => void;
  storyByParentId?: Record<string, { key: string; title: string }>;
  disableInternalDnd?: boolean;
}

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
  const columns: BoardColumnConfig[] = useMemo(() => {
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

  const cardFields: CardFields = useMemo(() => {
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
          <BoardColumn
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
