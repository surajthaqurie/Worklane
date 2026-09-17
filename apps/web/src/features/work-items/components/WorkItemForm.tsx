'use client';

import React, { useState } from 'react';
import { WorkItemType, WorkItemPriority, CreateWorkItemDto } from '@/shared/types/work-items';

export interface WorkItemFormProps {
  initialValues?: Partial<CreateWorkItemDto>;
  onSubmit: (values: CreateWorkItemDto) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function WorkItemForm({ initialValues, onSubmit, onCancel, isSubmitting }: WorkItemFormProps) {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [type, setType] = useState<WorkItemType>(initialValues?.type || 'TASK');
  const [priority, setPriority] = useState<WorkItemPriority>(initialValues?.priority || 'MEDIUM');
  const [points, setPoints] = useState<number | undefined>(initialValues?.points ?? undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      priority,
      state: initialValues?.state || 'TODO',
      points: points !== undefined && !isNaN(points) ? points : null,
      teamId: initialValues?.teamId,
      parentId: initialValues?.parentId,
      iterationId: initialValues?.iterationId,
      areaId: initialValues?.areaId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">Title</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
          placeholder="e.g. Implement login feature"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as WorkItemType)}
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
          >
            <option value="EPIC">Epic</option>
            <option value="FEATURE">Feature</option>
            <option value="STORY">User Story</option>
            <option value="TASK">Task</option>
            <option value="BUG">Bug</option>
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
          rows={4}
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
