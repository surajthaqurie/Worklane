'use client';

import React from 'react';
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { BacklogItem } from '@/shared/types/backlogs';
import { WorkItemState } from '@/shared/types/work-items';
import { Iteration } from '@/shared/types/iterations';
import { ProjectMember } from '@/shared/types/projects';
import { BacklogRow } from './BacklogRow';
import { EmptyState } from '@/shared/components/ui/EmptyState';

export interface FlatNode {
  item: BacklogItem;
  depth: number;
  isLoading?: boolean;
}

export interface BacklogTableProps {
  nodes: FlatNode[];
  expanded: Set<string>;
  selectedIds: Set<string>;
  editingId: string | null;
  editDraft: Partial<BacklogItem>;
  states: WorkItemState[];
  iterations: Iteration[];
  members: ProjectMember[];
  onToggleExpand: (id: string) => void;
  onSelectRow: (id: string, e: React.MouseEvent) => void;
  onToggleSelectRow: (id: string) => void;
  onOpenDrawer: (item: BacklogItem) => void;
  onAddChild: (parentItem: BacklogItem) => void;
  onStartEditing: (item: BacklogItem) => void;
  onCancelEditing: () => void;
  onSaveEditing: (item: BacklogItem) => void;
  onDraftChange: (field: keyof BacklogItem, value: unknown) => void;
  onReorder: (activeId: string, overId: string) => void;
  onSelectAllToggle: (allSelected: boolean) => void;
  onUpdateAssignee: (id: string, userId: string | null) => void;
  onUpdateState: (id: string, state: string) => void;
}

export function BacklogTable({
  nodes,
  expanded,
  selectedIds,
  editingId,
  editDraft,
  states,
  iterations,
  members,
  onToggleExpand,
  onSelectRow,
  onToggleSelectRow,
  onOpenDrawer,
  onAddChild,
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onDraftChange,
  onReorder,
  onSelectAllToggle,
  onUpdateAssignee,
  onUpdateState,
}: BacklogTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(active.id.toString(), over.id.toString());
    }
  };

  const allSelected = nodes.length > 0 && nodes.every((n) => selectedIds.has(n.item.id));

  return (
    <div className="flex flex-col border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center h-9 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[11px] font-semibold text-[var(--text-secondary)] select-none">
        <div className="flex items-center gap-1.5 px-2 shrink-0">
          <span className="w-5" />
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAllToggle(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-[var(--border-default)] accent-[var(--brand-primary)] cursor-pointer"
          />
        </div>
        <div className="w-44 shrink-0 px-2">Type / Key</div>
        <div className="flex-1 px-2">Title</div>
        <div className="w-28 shrink-0 px-2">State</div>
        <div className="w-24 shrink-0 px-2">Priority</div>
        <div className="w-16 shrink-0 px-2 text-center">Points</div>
        <div className="w-32 shrink-0 px-2">Assignee</div>
        <div className="w-32 shrink-0 px-2">Iteration</div>
      </div>

      {/* Rows List */}
      {nodes.length === 0 ? (
        <EmptyState title="No backlog items match your filters." />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={nodes.map((n) => n.item.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
              {nodes.map(({ item, depth, isLoading }) => (
                <BacklogRow
                  key={item.id}
                  item={item}
                  depth={depth}
                  isExpanded={expanded.has(item.id)}
                  isLoadingChildren={isLoading}
                  isSelected={selectedIds.has(item.id)}
                  isEditing={editingId === item.id}
                  editDraft={editDraft}
                  states={states}
                  iterations={iterations}
                  members={members}
                  onToggleExpand={onToggleExpand}
                  onSelectRow={onSelectRow}
                  onToggleSelectRow={onToggleSelectRow}
                  onOpenDrawer={onOpenDrawer}
                  onAddChild={onAddChild}
                  onStartEditing={onStartEditing}
                  onCancelEditing={onCancelEditing}
                  onSaveEditing={onSaveEditing}
                  onDraftChange={onDraftChange}
                  onUpdateAssignee={onUpdateAssignee}
                  onUpdateState={onUpdateState}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
