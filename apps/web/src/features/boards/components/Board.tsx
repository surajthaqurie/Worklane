'use client';

import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { WorkItem, WorkItemState } from '@/shared/types/work-items';
import { BoardConfig, BoardColumn as BoardColumnConfig, CardFields, WipBlockInfo } from '@/shared/types/boards';
import { BoardColumn } from './BoardColumn';

import { ProjectMember } from '@/shared/types/projects';
import { groupIntoSwimlanes } from '../swimlanes';

export interface BoardProps {
  items: WorkItem[];
  states: WorkItemState[];
  board?: BoardConfig | null;
  onStateChange?: (itemId: string, stateKey: string) => void;
  /**
   * WIP-aware move handler (board page). When provided it replaces
   * `onStateChange` for internal drags, letting the caller run the
   * `useBoardMoveWorkItem` optimistic flow instead of the plain transition.
   */
  onMoveWorkItem?: (
    itemId: string,
    stateKey: string,
    options?: { expectedVersion?: number; previousState?: string }
  ) => void;
  /** Fired when a drop is rejected client-side because the column is at its WIP limit. */
  onWipBlocked?: (info: WipBlockInfo) => void;
  onSelectItem: (item: WorkItem) => void;
  onRemoveItem?: (item: WorkItem) => void;
  storyByParentId?: Record<string, { key: string; title: string }>;
  disableInternalDnd?: boolean;
  members?: ProjectMember[];
  /** Epic work items used to label epic swimlanes. */
  epics?: WorkItem[];
  onAssign?: (itemId: string, userId: string | null) => void;
  onQuickAdd?: (stateKey: string) => void;
}

interface ParsedDropTarget {
  groupId: string | null;
  columnId: string;
}

/** Legacy board page / sprint view progressions (`col-{id}`). */
function parseDroppableId(id: string): ParsedDropTarget | null {
  if (id.startsWith('swimlane:')) {
    const rest = id.slice('swimlane:'.length);
    const idx = rest.lastIndexOf(':col:');
    if (idx === -1) return null;
    return { groupId: decodeURIComponent(rest.slice(0, idx)), columnId: rest.slice(idx + 5) };
  }
  if (id.startsWith('col-')) {
    let columnId = id.slice('col-'.length);
    if (columnId.startsWith('col-')) {
      columnId = columnId.slice('col-'.length);
    }
    return { groupId: null, columnId };
  }
  return null;
}

function findColumn(columns: BoardColumnConfig[], columnId: string): BoardColumnConfig | undefined {
  return (
    columns.find(
      (c) =>
        c.id === columnId ||
        c.id === `col-${columnId}` ||
        c.id.toLowerCase() === columnId.toLowerCase() ||
        c.id.toLowerCase() === `col-${columnId.toLowerCase()}`
    ) ||
    columns.find((c) => c.mappedStates.some((s) => s === columnId || s.toLowerCase() === columnId.toLowerCase()))
  );
}

export function Board({
  items,
  states,
  board,
  onStateChange,
  onMoveWorkItem,
  onWipBlocked,
  onSelectItem,
  onRemoveItem,
  storyByParentId = {},
  disableInternalDnd = false,
  members = [],
  epics = [],
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

  const swimlaneType = board?.swimlane ?? 'none';
  const showLaneHeaders = swimlaneType !== 'none';

  const resolveParent = useMemo(() => {
    const byId = new Map<string, { key: string; title: string }>();
    for (const epic of epics) byId.set(epic.id, { key: epic.key, title: epic.title });
    for (const [parentId, info] of Object.entries(storyByParentId)) byId.set(parentId, info);
    return (parentId: string) => byId.get(parentId);
  }, [epics, storyByParentId]);

  const lanes = useMemo(() => {
    return groupIntoSwimlanes(swimlaneType, items, { members, resolveParent });
  }, [swimlaneType, items, members, resolveParent]);

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

  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);

  // Columns that would exceed their WIP limit if the dragged item were dropped
  // there (visible board counts — the server remains the authoritative check).
  const blockedColumns = useMemo(() => {
    const blocked = new Set<string>();
    if (!activeItem) return blocked;
    const sourceColumn = columns.find((c) => c.mappedStates.includes(activeItem.state));
    for (const col of columns) {
      if (sourceColumn?.id === col.id || col.wipLimit == null) continue;
      const count = itemsByColumnId.get(col.id)?.length ?? 0;
      if (count >= col.wipLimit) blocked.add(col.id);
    }
    return blocked;
  }, [activeItem, columns, itemsByColumnId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current?.item as WorkItem | undefined;
    setActiveItem(item ?? null);
  };

  const handleDragCancel = () => {
    setActiveItem(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    if (!over) return;

    const parsed = parseDroppableId(over.id.toString());
    if (!parsed) return;

    const targetColumn = findColumn(columns, parsed.columnId);
    if (!targetColumn || targetColumn.mappedStates.length === 0) return;

    const targetStateKey = targetColumn.mappedStates[0];
    const item = active.data.current?.item as WorkItem | undefined;
    if (!item || item.state === targetStateKey) return;

    const sourceColumn = columns.find((c) => c.mappedStates.includes(item.state));
    const movingBetweenColumns = sourceColumn?.id !== targetColumn.id;

    // Client-side WIP guard: never silently drop a move. When the visible
    // board already shows the column at its limit, surface a structured block
    // immediately and skip the round-trip. Any move a filtered view lets
    // through is still rejected server-side with the same structured 409.
    if (movingBetweenColumns && targetColumn.wipLimit != null) {
      const currentCount = itemsByColumnId.get(targetColumn.id)?.length ?? 0;
      if (currentCount >= targetColumn.wipLimit) {
        onWipBlocked?.({
          columnId: targetColumn.id,
          columnName: targetColumn.name,
          currentCount,
          wipLimit: targetColumn.wipLimit,
        });
        return;
      }
    }

    if (onMoveWorkItem) {
      onMoveWorkItem(item.id, targetStateKey, {
        expectedVersion: item.version,
        previousState: item.state,
      });
    } else {
      onStateChange?.(item.id, targetStateKey);
    }
  };

  const content = (
    <div className="h-full w-full min-h-[400px] overflow-x-auto overflow-y-auto">
      <div className="flex flex-col gap-6 pb-4 pr-4 min-w-full w-max">
        {lanes.map(({ group, items: laneItems }) => (
          <div key={group.id} className="flex flex-col gap-2">
            {showLaneHeaders && (
              <div className="flex items-center gap-2 px-1 shrink-0">
                <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                  {group.title || 'Items'}
                </span>
                {group.subtitle && (
                  <span className="text-[11px] text-[var(--text-muted)] truncate hidden sm:inline">
                    {group.subtitle}
                  </span>
                )}
                <span className="text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-surface-hover)] px-1.5 py-0.5 rounded-full border border-[var(--border-subtle)] shrink-0">
                  {laneItems.length}
                </span>
              </div>
            )}

            <div className="flex gap-4 items-stretch">
              {columns.map((col) => {
                const columnItems = laneItems.filter((w) => col.mappedStates.includes(w.state));
                return (
                  <BoardColumn
                    key={`${group.id}:${col.id}`}
                    groupId={swimlaneType === 'none' ? undefined : group.id}
                    column={col}
                    items={columnItems}
                    states={states}
                    cardFields={cardFields}
                    wipBlocked={blockedColumns.has(col.id)}
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
          </div>
        ))}
      </div>
    </div>
  );

  if (disableInternalDnd) {
    return content;
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {content}
    </DndContext>
  );
}