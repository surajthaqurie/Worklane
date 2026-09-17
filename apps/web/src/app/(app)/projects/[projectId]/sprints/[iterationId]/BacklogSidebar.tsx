'use client';
import React from 'react';
import { useWorkItems, WorkItem } from '@/hooks/useWorkItems';
import { useProjectContext } from '@/app/(app)/projects/[projectId]/project-layout-client';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, X } from 'lucide-react';

function DraggableBacklogItem({ item }: { item: WorkItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item, fromBacklog: true },
  });

  return (
    <div
      ref={setNodeRef}
      className={`p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] flex flex-col gap-2 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <button className="text-[var(--text-muted)] cursor-grab active:cursor-grabbing" {...listeners} {...attributes}>
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="text-[12px] font-medium text-[var(--text-secondary)]">{item.key}</span>
        <span className="text-[11px] bg-[var(--bg-surface-hover)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] ml-auto">{item.type}</span>
      </div>
      <p className="text-[13px] font-medium text-[var(--text-primary)] leading-snug pl-6">{item.title}</p>
    </div>
  );
}

export function BacklogSidebar({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { selectedTeamId } = useProjectContext();
  const { data: workItems = [], isLoading } = useWorkItems(projectId, {}, selectedTeamId);
  const backlogItems = workItems.filter((item: WorkItem) => !item.iterationId);

  return (
    <div className="w-80 border-l border-[var(--border-subtle)] bg-[var(--bg-app)] flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Backlog</h3>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Drag items to the iteration board</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-[var(--bg-surface-hover)] rounded-full text-[var(--text-secondary)] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-2">
        {isLoading ? (
          <div className="text-[12px] text-[var(--text-muted)] p-2">Loading...</div>
        ) : backlogItems.length === 0 ? (
          <div className="text-[12px] text-[var(--text-muted)] p-2 text-center">No backlog items available.</div>
        ) : (
          backlogItems.map((item: WorkItem) => <DraggableBacklogItem key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}
