'use client';
import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useIteration, useUpdateIteration, useDeleteIteration, useRemoveWorkItemFromIteration, useSprintBoard, useIterations, useActivateIteration, useCompleteIteration } from '@/hooks/useIterations';
import { format } from 'date-fns';
import Link from 'next/link';
import { WorkItem, useUpdateWorkItem, useTransitionWorkItemState } from '@/hooks/useWorkItems';
import { WorkItemState } from '@/hooks/useWorkItemStates';
import { Board } from '@/components/Board';
import { StatesManager } from '@/components/StatesManager';
import { WorkItemDrawer } from '@/components/WorkItemDrawer';
import { CompleteSprintDialog } from '@/components/CompleteSprintDialog';
import { useProjectContext } from '@/app/(app)/projects/[projectId]/project-layout-client';
import { Trash2 } from 'lucide-react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { BacklogSidebar } from './BacklogSidebar';
import { PanelRightOpen } from 'lucide-react';


export default function IterationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const iterationId = params.iterationId as string;
  const { selectedTeamId } = useProjectContext();

  const { data: iteration, isLoading } = useIteration(projectId, iterationId);
  const { data: board, isLoading: isLoadingWorkItems } = useSprintBoard(projectId, iterationId, selectedTeamId);
  const workItems = useMemo(
    () => board?.groups.flatMap((g) => g.items) ?? [],
    [board],
  );
  const states = (board?.states ?? []) as WorkItemState[];
  const updateIteration = useUpdateIteration(projectId);
  const deleteIteration = useDeleteIteration(projectId);
  const removeWorkItem = useRemoveWorkItemFromIteration(projectId);
  const updateWorkItem = useUpdateWorkItem(projectId);
  const transitionWorkItem = useTransitionWorkItemState(projectId);
  const activateIteration = useActivateIteration(projectId);
  const completeIteration = useCompleteIteration(projectId);
  const { data: iterations = [] } = useIterations(projectId, selectedTeamId);

  const doneCount = useMemo(
    () => board?.groups.filter((g) => g.state.isDone).reduce((n, g) => n + g.items.length, 0) ?? 0,
    [board],
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', goal: '' });
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);

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

  if (isLoading) return <div className="p-8 text-[var(--text-muted)] text-[13px]">Loading iteration...</div>;
  if (!iteration) return <div className="p-8 text-[var(--priority-high)] text-[13px]">Iteration not found</div>;

  const handleStartEdit = () => {
    setEditData({ name: iteration.name, goal: iteration.goal || '' });
    setIsEditing(true);
  };

  const handleSave = async () => {
    await updateIteration.mutateAsync({
      id: iterationId,
      data: editData,
    });
    setIsEditing(false);
  };

  const handleStartIteration = () => {
    activateIteration.mutate(iterationId, {
      onError: (err: Error) => {
        alert(err.message || 'Failed to start sprint. Only one active sprint is allowed per project.');
      },
    });
  };

  const handleDelete = async () => {
    if (!window.confirm(
      `Delete ${iteration.state === 'ACTIVE' ? 'this active' : ''} iteration "${iteration.name}"?\n` +
      'Active sprints must be completed first, and sprints with child sprints cannot be deleted.',
    )) return;
    try {
      await deleteIteration.mutateAsync(iterationId);
      router.push(`/projects/${projectId}/sprints`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete sprint.');
    }
  };

  const handleRemoveWorkItem = async (item: WorkItem) => {
    if (!window.confirm('Remove this item from the iteration? It will move back to the backlog.')) return;
    await removeWorkItem.mutateAsync({ iterationId, workItemId: item.id });
  };


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    const overId = over.id.toString();
    if (!overId.startsWith('state-')) return;
    
    const stateKey = overId.slice('state-'.length);
    const itemId = active.id.toString();
    const isFromBacklog = active.data.current?.fromBacklog;
    
    if (isFromBacklog) {
      updateWorkItem.mutate({ id: itemId, data: { iterationId } });
      transitionWorkItem.mutate({ id: itemId, state: stateKey });
    } else {
      transitionWorkItem.mutate({ id: itemId, state: stateKey });
    }
  };


  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-shrink-0 bg-[var(--bg-app)] border-b border-[var(--border-subtle)] pb-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <Link href={`/projects/${projectId}/sprints`} className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">&larr; Back to Sprints</Link>
        </div>

        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-3">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  className="border border-[var(--border-default)] px-3 py-1.5 rounded-[var(--radius-input)] text-[14px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                />
                <button onClick={handleSave} className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white px-3 py-1.5 rounded-[var(--radius-button)] text-[12px] font-medium transition-colors">Save</button>
                <button onClick={() => setIsEditing(false)} className="bg-[var(--bg-surface-hover)] text-[var(--text-primary)] px-3 py-1.5 rounded-[var(--radius-button)] text-[12px] font-medium transition-colors border border-[var(--border-subtle)]">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">{iteration.name}</h1>
                <button onClick={handleStartEdit} className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">Edit</button>
                {iteration.state === 'ACTIVE' && (
                  <span className="text-[11px] bg-[var(--bg-surface-selected)] text-[var(--brand-primary)] px-2.5 py-0.5 rounded-full font-medium">ACTIVE</span>
                )}
                {iteration.state === 'COMPLETED' && (
                  <span className="text-[11px] bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] px-2.5 py-0.5 rounded-full font-medium">COMPLETED</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-6 text-[13px]">
              {iteration.path && iteration.path !== iteration.name && (
                <div className="text-[var(--text-muted)] font-mono text-[12px]" title={iteration.path}>
                  {iteration.path}
                </div>
              )}
              <div className="text-[var(--text-secondary)] font-medium">
                {format(new Date(iteration.startDate), 'MMM d, yyyy')} &rarr; {format(new Date(iteration.endDate), 'MMM d, yyyy')}
              </div>
              {isEditing ? (
                <input
                  placeholder="Iteration Goal"
                  className="border border-[var(--border-default)] px-3 py-1 rounded-[var(--radius-input)] w-64 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                  value={editData.goal}
                  onChange={(e) => setEditData({ ...editData, goal: e.target.value })}
                />
              ) : (
                <div className="text-[var(--text-secondary)] border-l border-[var(--border-subtle)] pl-6">
                  <span className="font-medium mr-2 text-[var(--text-primary)]">Goal:</span>
                  {iteration.goal || <span className="text-[var(--text-muted)] italic">No goal set</span>}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {iteration.state === 'PLANNED' && (
              <button onClick={handleStartIteration} className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white px-4 py-2 rounded-[var(--radius-button)] text-[13px] font-medium transition-colors">
                Start Sprint
              </button>
            )}
            {iteration.state === 'ACTIVE' && (
              <button onClick={() => setIsCompleteOpen(true)} className="bg-[var(--status-done)] hover:bg-[#0ea5e9] text-white px-4 py-2 rounded-[var(--radius-button)] text-[13px] font-medium transition-colors">
                Complete Sprint
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={deleteIteration.isPending}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--priority-high)] hover:bg-[var(--priority-high)]/10 rounded-[var(--radius-button)] transition-colors flex items-center gap-1.5 text-[13px] font-medium"
              title="Delete iteration"
            >
              <Trash2 className="w-4 h-4" />
              {deleteIteration.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="flex-grow overflow-auto flex flex-col min-h-0 pr-4">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
            Iteration Backlog · <span className="text-[var(--text-secondary)] font-medium">{workItems.length} {workItems.length === 1 ? 'item' : 'items'}</span>
          </h2>
          <div className="flex items-center gap-2">
            <Link
              href={`/projects/${projectId}/backlogs`}
              className="inline-flex items-center px-3 py-2 text-[13px] font-medium text-[var(--brand-primary)] hover:bg-[var(--bg-surface-selected)] rounded-[var(--radius-button)] transition-colors"
            >
              + Add items from backlog
            </Link>
            <button
              onClick={() => setIsSidebarOpen((open) => !open)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium rounded-[var(--radius-button)] transition-colors border ${
                isSidebarOpen
                  ? 'bg-[var(--bg-surface-selected)] text-[var(--brand-primary)] border-[var(--brand-primary)]/30'
                  : 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
              title="Toggle backlog sidebar"
            >
              <PanelRightOpen className="w-4 h-4" />
              Backlog
            </button>
            <StatesManager projectId={projectId} />
          </div>
        </div>

        {isLoadingWorkItems ? (
          <div className="text-[13px] text-[var(--text-muted)]">Loading items...</div>
        ) : (
          <>
            {workItems.length === 0 && (
              <div className="text-[13px] text-[var(--text-muted)] mb-3">
                This sprint has no items yet. Drag items from the backlog sidebar onto a column to plan your sprint.
              </div>
            )}
            <Board
              items={workItems}
              states={states}
              onStateChange={() => {}} disableInternalDnd={true}
              onSelectItem={setSelectedItem}
              onRemoveItem={handleRemoveWorkItem}
              storyByParentId={storyByParentId}
            />
          </>
        )}
        </div>
        {isSidebarOpen && <BacklogSidebar projectId={projectId} onClose={() => setIsSidebarOpen(false)} />}
      </div>
    </DndContext>

      {isCompleteOpen && iteration && (
        <CompleteSprintDialog
          iteration={iteration}
          iterations={iterations.filter(
            (it) => it.state !== 'COMPLETED' && it.id !== iteration.id,
          )}
          onComplete={completeIteration}
          onClose={() => setIsCompleteOpen(false)}
          incompleteCount={workItems.length - doneCount}
          workItemsCount={workItems.length}
          doneWorkItemsCount={doneCount}
        />
      )}

      {selectedItem && (
        <WorkItemDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}