'use client';

import React, { useMemo } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { WorkItem, WorkItemState } from '@/shared/types/work-items';
import { BoardConfig, BoardColumn as BoardColumnConfig, CardFields } from '@/shared/types/boards';
import { BoardColumn } from './BoardColumn';

import { ProjectMember } from '@/shared/types/projects';

export interface BoardProps {
  items: WorkItem[];
  states: WorkItemState[];
  board?: BoardConfig | null;
  onStateChange: (itemId: string, stateKey: string) => void;
  onSelectItem: (item: WorkItem) => void;
  onRemoveItem?: (item: WorkItem) => void;
  storyByParentId?: Record<string, { key: string; title: string }>;
  disableInternalDnd?: boolean;
  members?: ProjectMember[];
  onAssign?: (itemId: string, userId: string | null) => void;
  onQuickAdd?: (stateKey: string) => void;
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
  members = [],
  onAssign,
  onQuickAdd,
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

    let columnId = overId.slice('col-'.length);
    if (columnId.startsWith('col-')) {
      columnId = columnId.slice('col-'.length);
    }

    const targetColumn = columns.find(
      (c) =>
        c.id === columnId ||
        c.id === `col-${columnId}` ||
        c.id.toLowerCase() === columnId.toLowerCase() ||
        c.id.toLowerCase() === `col-${targetColumnId(columnId)}`
    );
    if (!targetColumn || targetColumn.mappedStates.length === 0) return;

    const targetStateKey = targetColumn.mappedStates[0];
    const item = active.data.current?.item as WorkItem | undefined;
    if (!item || item.state === targetStateKey) return;

    onStateChange(item.id, targetStateKey);
  };

  function targetColumnId(id: string) {
    return id.toLowerCase();
  }

  const itemsByColumnId = useMemo(() => {
    const map = new Map<string, WorkItem[]>();
    for (const col of columns) {
      map.set(
        col.id,
        items.filter((w) => col.mappedStates.includes(w.state))
      );
    }
    return map;
  }, [columns, items]);

  const childrenByParentId = useMemo(() => {
    const map: Record<string, WorkItem[]> = {};
    items.forEach((w) => {
      if (w.parentId) {
        if (!map[w.parentId]) map[w.parentId] = [];
        map[w.parentId].push(w);
      }
    });
    return map;
  }, [items]);

  const content = (
    <div className="flex gap-4 overflow-x-auto pb-4 items-stretch h-full w-full min-h-[400px]">
      {columns.map((col) => {
        const columnItems = itemsByColumnId.get(col.id) || [];
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
            childrenByParentId={childrenByParentId}
            members={members}
            onAssign={onAssign}
            onQuickAdd={onQuickAdd}
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
