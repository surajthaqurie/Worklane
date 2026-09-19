'use client';

import React, { useState } from 'react';
import { WorkItemType, WorkItemPriority, CreateWorkItemDto, WorkItem } from '@/shared/types/work-items';
import { useWorkItems } from '../hooks/useWorkItems';
import { useWorkItemStates } from '../hooks/useWorkItemStates';
import { useProjectMembers } from '@/features/projects/hooks/useProjects';

export interface WorkItemFormProps {
  projectId?: string;
  initialValues?: Partial<CreateWorkItemDto>;
  onSubmit: (values: CreateWorkItemDto) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function WorkItemForm({
  projectId = '',
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
}: WorkItemFormProps) {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [type, setType] = useState<WorkItemType>(initialValues?.type || 'TASK');
  const [priority, setPriority] = useState<WorkItemPriority>(initialValues?.priority || 'MEDIUM');
  const [points, setPoints] = useState<number | undefined>(initialValues?.points ?? undefined);
  const [assignedTo, setAssignedTo] = useState<string | null>(initialValues?.assignedTo ?? null);
  const [parentId, setParentId] = useState<string | null>(initialValues?.parentId ?? null);
  const [state, setState] = useState<string>(initialValues?.state || 'TODO');

  const { data: states = [] } = useWorkItemStates(projectId);
  const { data: projectMembers = [] } = useProjectMembers(projectId);
  const { data: allWorkItems = [] } = useWorkItems(projectId, initialValues?.teamId, { limit: '200' });

  React.useEffect(() => {
    if (initialValues?.state) {
      setState(initialValues.state);
    }
  }, [initialValues?.state]);

  // Filter valid parent candidates based on selected type
  const parentCandidates = allWorkItems.filter((item: WorkItem) => {
    if (type === 'TASK' || type === 'BUG') {
      return item.type === 'STORY' || item.type === 'FEATURE' || item.type === 'EPIC';
    }
    if (type === 'STORY') {
      return item.type === 'FEATURE' || item.type === 'EPIC';
    }
    if (type === 'FEATURE') {
      return item.type === 'EPIC';
    }
    return false;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      priority,
      state,
      points: points !== undefined && !isNaN(points) ? points : null,
      assignedTo: assignedTo || null,
      parentId: parentId || null,
      teamId: initialValues?.teamId,
      iterationId: initialValues?.iterationId,
      areaId: initialValues?.areaId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">Title *</label>
        <textarea
          required
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={2}
          className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors resize-y whitespace-pre-wrap leading-snug"
          placeholder="e.g. Fix login error or Add task list"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as WorkItemType)}
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
          >
            <option value="TASK">Task</option>
            <option value="BUG">Bug</option>
            <option value="STORY">User Story</option>
            <option value="FEATURE">Feature</option>
            <option value="EPIC">Epic</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">State</label>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
          >
            {states.length > 0 ? (
              states.map((s) => (
                <option key={s.id || s.key} value={s.key}>
                  {s.name}
                </option>
              ))
            ) : (
              <option value="TODO">To Do</option>
            )}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as WorkItemPriority)}
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">Assignee</label>
          <select
            value={assignedTo ?? ''}
            onChange={(e) => setAssignedTo(e.target.value || null)}
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
          >
            <option value="">Unassigned</option>
            {projectMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.userName} ({m.userEmail || m.role})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">Parent Item</label>
          <select
            value={parentId ?? ''}
            onChange={(e) => setParentId(e.target.value || null)}
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
          >
            <option value="">No Parent (Root Item)</option>
            {parentCandidates.map((parentItem) => (
              <option key={parentItem.id} value={parentItem.id}>
                [{parentItem.key}] {parentItem.title} ({parentItem.type})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">Story Points</label>
        <input
          type="number"
          min={0}
          value={points ?? ''}
          onChange={(e) => setPoints(e.target.value ? parseInt(e.target.value, 10) : undefined)}
          className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
          placeholder="e.g. 3"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
          placeholder="Add more details..."
        />
      </div>

      <div className="flex justify-end gap-3 mt-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || !title.trim()}
          className="px-4 py-2 text-xs font-medium bg-[var(--brand-primary)] text-white hover:opacity-90 rounded-[var(--radius-button)] transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Create Item'}
        </button>
      </div>
    </form>
  );
}
