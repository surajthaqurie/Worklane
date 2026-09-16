'use client';
import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useWorkItems, WorkItem, useUpdateWorkItem, useTransitionWorkItemState } from '@/hooks/useWorkItems';
import { useWorkItemStates } from '@/hooks/useWorkItemStates';
import { Board } from '@/components/Board';
import { StatesManager } from '@/components/StatesManager';
import { WorkItemDrawer } from '@/components/WorkItemDrawer';
import { SquareKanban } from 'lucide-react';

export default function ProjectBoardPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  // We want to fetch all items for the board. We'll pass a high limit.
  // We can filter out TASK types on the client to only show Stories and Bugs (the main backlog items).
  const { data: workItems = [], isLoading: isLoadingWorkItems } = useWorkItems(projectId, { limit: '1000' } as any);
  const { data: states = [] } = useWorkItemStates(projectId);
  const updateWorkItem = useUpdateWorkItem(projectId);
  const transitionWorkItem = useTransitionWorkItemState(projectId);

  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [backlogLevel, setBacklogLevel] = useState<'EPIC' | 'FEATURE' | 'STORY'>('STORY');

  const boardItems = useMemo(() => {
    return workItems.filter((item: WorkItem) => {
      if (backlogLevel === 'EPIC') return item.type === 'EPIC';
      if (backlogLevel === 'FEATURE') return item.type === 'FEATURE';
      return item.type === 'STORY' || item.type === 'BUG';
    });
  }, [workItems, backlogLevel]);

  const storyByParentId = useMemo(() => {
    const map: Record<string, { key: string; title: string }> = {};
    const byId = new Map<string, WorkItem>(workItems.map((item: WorkItem) => [item.id, item]));
    workItems.forEach((item: WorkItem) => {
      if (item.parentId && byId.has(item.parentId)) {
        map[item.parentId] = { key: byId.get(item.parentId)!.key, title: byId.get(item.parentId)!.title };
      }
    });
    return map;
  }, [workItems]);

  const handleDragState = (itemId: string, state: string) => {
    transitionWorkItem.mutate({ id: itemId, state });
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-shrink-0 bg-[var(--bg-app)] border-b border-[var(--border-subtle)] pb-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-[var(--radius-button)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center">
            <SquareKanban className="w-5 h-5" />
          </div>
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">Project Board</h1>
        </div>
        <p className="text-[14px] text-[var(--text-secondary)]">
          Board view of your Stories and Bugs across the entire project.
        </p>
      </div>

      <div className="flex-grow overflow-auto flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
              Board · <span className="text-[var(--text-secondary)] font-medium">{boardItems.length} {boardItems.length === 1 ? 'item' : 'items'}</span>
            </h2>
            <select
              value={backlogLevel}
              onChange={(e) => setBacklogLevel(e.target.value as any)}
              className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2 py-1 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
            >
              <option value="EPIC">Epics</option>
              <option value="FEATURE">Features</option>
              <option value="STORY">Stories & Bugs</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <StatesManager projectId={projectId} />
          </div>
        </div>

        {isLoadingWorkItems ? (
          <div className="text-[13px] text-[var(--text-muted)]">Loading board...</div>
        ) : boardItems.length === 0 ? (
          <div className="text-[13px] text-[var(--text-muted)] p-8 text-center border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)]">
            No Stories or Bugs found in this project.
          </div>
        ) : (
          <Board
            items={boardItems}
            states={states}
            onStateChange={handleDragState}
            onSelectItem={setSelectedItem}
            storyByParentId={storyByParentId}
          />
        )}
      </div>

      {selectedItem && (
        <WorkItemDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
