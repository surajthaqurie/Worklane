'use client';
import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSprint, useUpdateSprint, useDeleteSprint, useRemoveWorkItemFromSprint } from '@/hooks/useSprints';
import { format } from 'date-fns';
import Link from 'next/link';
import { useSprintWorkItems } from '@/hooks/useSprints';
import { WorkItem, useUpdateWorkItem } from '@/hooks/useWorkItems';
import { useWorkItemStates } from '@/hooks/useWorkItemStates';
import { Board } from '@/components/Board';
import { StatesManager } from '@/components/StatesManager';
import { WorkItemDrawer } from '@/components/WorkItemDrawer';
import { Trash2 } from 'lucide-react';

export default function SprintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const sprintId = params.sprintId as string;

  const { data: sprint, isLoading } = useSprint(projectId, sprintId);
  const { data: workItems = [], isLoading: isLoadingWorkItems } = useSprintWorkItems(projectId, sprintId, {});
  const { data: states = [] } = useWorkItemStates(projectId);
  const updateSprint = useUpdateSprint(projectId);
  const deleteSprint = useDeleteSprint(projectId);
  const removeWorkItem = useRemoveWorkItemFromSprint(projectId);
  const updateWorkItem = useUpdateWorkItem(projectId);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', goal: '' });
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);

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

  if (isLoading) return <div className="p-8 text-[var(--text-muted)] text-[13px]">Loading sprint...</div>;
  if (!sprint) return <div className="p-8 text-[var(--priority-high)] text-[13px]">Sprint not found</div>;

  const handleStartEdit = () => {
    setEditData({ name: sprint.name, goal: sprint.goal || '' });
    setIsEditing(true);
  };

  const handleSave = async () => {
    await updateSprint.mutateAsync({
      id: sprintId,
      data: editData,
    });
    setIsEditing(false);
  };

  const handleStateChange = async (newState: string) => {
    try {
      await updateSprint.mutateAsync({
        id: sprintId,
        data: { state: newState },
      });
    } catch {
      alert('Failed to update state. Only one active sprint is allowed per project.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete sprint "${sprint.name}"? Work items will be moved back to the backlog.`)) return;
    await deleteSprint.mutateAsync(sprintId);
    router.push(`/projects/${projectId}/sprints`);
  };

  const handleRemoveWorkItem = async (item: WorkItem) => {
    if (!window.confirm('Remove this item from the sprint? It will move back to the backlog.')) return;
    await removeWorkItem.mutateAsync({ sprintId, workItemId: item.id });
  };

  const handleDragState = (itemId: string, state: string) => {
    updateWorkItem.mutate({ id: itemId, data: { state } });
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
                <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">{sprint.name}</h1>
                <button onClick={handleStartEdit} className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">Edit</button>
                {sprint.state === 'ACTIVE' && (
                  <span className="text-[11px] bg-[var(--bg-surface-selected)] text-[var(--brand-primary)] px-2.5 py-0.5 rounded-full font-medium">ACTIVE</span>
                )}
                {sprint.state === 'COMPLETED' && (
                  <span className="text-[11px] bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] px-2.5 py-0.5 rounded-full font-medium">COMPLETED</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-6 text-[13px]">
              <div className="text-[var(--text-secondary)] font-medium">
                {format(new Date(sprint.startDate), 'MMM d, yyyy')} &rarr; {format(new Date(sprint.endDate), 'MMM d, yyyy')}
              </div>
              {isEditing ? (
                <input
                  placeholder="Sprint Goal"
                  className="border border-[var(--border-default)] px-3 py-1 rounded-[var(--radius-input)] w-64 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                  value={editData.goal}
                  onChange={(e) => setEditData({ ...editData, goal: e.target.value })}
                />
              ) : (
                <div className="text-[var(--text-secondary)] border-l border-[var(--border-subtle)] pl-6">
                  <span className="font-medium mr-2 text-[var(--text-primary)]">Goal:</span>
                  {sprint.goal || <span className="text-[var(--text-muted)] italic">No goal set</span>}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {sprint.state === 'PLANNED' && (
              <button onClick={() => handleStateChange('ACTIVE')} className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white px-4 py-2 rounded-[var(--radius-button)] text-[13px] font-medium transition-colors">
                Start Sprint
              </button>
            )}
            {sprint.state === 'ACTIVE' && (
              <button onClick={() => handleStateChange('COMPLETED')} className="bg-[var(--status-done)] hover:bg-[#0ea5e9] text-white px-4 py-2 rounded-[var(--radius-button)] text-[13px] font-medium transition-colors">
                Complete Sprint
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={deleteSprint.isPending}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--priority-high)] hover:bg-[var(--priority-high)]/10 rounded-[var(--radius-button)] transition-colors flex items-center gap-1.5 text-[13px] font-medium"
              title="Delete sprint"
            >
              <Trash2 className="w-4 h-4" />
              {deleteSprint.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-auto flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
            Sprint Backlog · <span className="text-[var(--text-secondary)] font-medium">{workItems.length} {workItems.length === 1 ? 'item' : 'items'}</span>
          </h2>
          <div className="flex items-center gap-2">
            <Link
              href={`/projects/${projectId}/backlog`}
              className="inline-flex items-center px-3 py-2 text-[13px] font-medium text-[var(--brand-primary)] hover:bg-[var(--bg-surface-selected)] rounded-[var(--radius-button)] transition-colors"
            >
              + Add items from backlog
            </Link>
            <StatesManager projectId={projectId} />
          </div>
        </div>

        {isLoadingWorkItems ? (
          <div className="text-[13px] text-[var(--text-muted)]">Loading items...</div>
        ) : workItems.length === 0 ? (
          <div className="text-[13px] text-[var(--text-muted)] p-8 text-center border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)]">
            No items in this sprint yet. Drag items from the backlog to plan your sprint.
          </div>
        ) : (
          <Board
            items={workItems}
            states={states}
            onStateChange={handleDragState}
            onSelectItem={setSelectedItem}
            onRemoveItem={handleRemoveWorkItem}
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