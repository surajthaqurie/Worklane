'use client';

import React, { useState } from 'react';
import { WorkItemType, WorkItemPriority, SeverityLevel, CreateWorkItemDto } from '@/shared/types/work-items';
import { useWorkItemStates } from '../hooks/useWorkItemStates';

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
  const [severity, setSeverity] = useState<SeverityLevel>(initialValues?.severity || 'MEDIUM');
  const [points, setPoints] = useState<number | undefined>(initialValues?.points ?? undefined);
  const [remainingWork, setRemainingWork] = useState<number | undefined>(initialValues?.remainingWork ?? undefined);
  const [completedWork, setCompletedWork] = useState<number | undefined>(initialValues?.completedWork ?? undefined);
  const [startDate, setStartDate] = useState<string>(initialValues?.startDate ? initialValues.startDate.slice(0, 10) : '');
  const [targetDate, setTargetDate] = useState<string>(initialValues?.targetDate ? initialValues.targetDate.slice(0, 10) : '');
  const assignedTo = initialValues?.assignedTo ?? null;
  const parentId = initialValues?.parentId ?? null;
  const [state, setState] = useState<string>(initialValues?.state || 'TODO');
  const [dateError, setDateError] = useState<string | null>(null);

  const { data: states = [] } = useWorkItemStates(projectId);

  const [prevInitialState, setPrevInitialState] = useState(initialValues?.state);
  if (initialValues?.state !== prevInitialState) {
    setPrevInitialState(initialValues?.state);
    if (initialValues?.state) {
      setState(initialValues.state);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (startDate && targetDate && new Date(targetDate) < new Date(startDate)) {
      setDateError('Target date cannot be earlier than start date');
      return;
    }
    setDateError(null);

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      priority,
      severity,
      state,
      points: points !== undefined && !isNaN(points) ? points : null,
      remainingWork: remainingWork !== undefined && !isNaN(remainingWork) ? remainingWork : null,
      completedWork: completedWork !== undefined && !isNaN(completedWork) ? completedWork : null,
      startDate: startDate || null,
      targetDate: targetDate || null,
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
        <label htmlFor="field-title" className="text-[13px] font-medium text-[var(--text-secondary)]">Title *</label>
        <textarea
          id="field-title"
          required
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={2}
          className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors resize-y whitespace-pre-wrap leading-snug"
          placeholder="e.g. Fix login error or Add task list"
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="field-type" className="text-[13px] font-medium text-[var(--text-secondary)]">Type</label>
          <select
            id="field-type"
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
          <label htmlFor="field-state" className="text-[13px] font-medium text-[var(--text-secondary)]">State</label>
          <select
            id="field-state"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
          >
            {states.length > 0 ? (
              states.map((s) => (
                <option key={s.id || s.key} value={s.key}>
                  {s.name} ({s.category || 'PROPOSED'})
                </option>
              ))
            ) : (
              <option value="TODO">To Do</option>
            )}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="field-priority" className="text-[13px] font-medium text-[var(--text-secondary)]">Priority</label>
          <select
            id="field-priority"
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

        <div className="flex flex-col gap-1.5">
          <label htmlFor="field-severity" className="text-[13px] font-medium text-[var(--text-secondary)]">Severity</label>
          <select
            id="field-severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="field-points" className="text-[13px] font-medium text-[var(--text-secondary)]">Points</label>
          <input
            id="field-points"
            type="number"
            min={0}
            value={points ?? ''}
            onChange={(e) => setPoints(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
            placeholder="e.g. 3"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="field-remaining-work" className="text-[13px] font-medium text-[var(--text-secondary)]">Remaining (h)</label>
          <input
            id="field-remaining-work"
            type="number"
            min={0}
            step="0.5"
            value={remainingWork ?? ''}
            onChange={(e) => setRemainingWork(e.target.value ? parseFloat(e.target.value) : undefined)}
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
            placeholder="e.g. 8"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="field-completed-work" className="text-[13px] font-medium text-[var(--text-secondary)]">Completed (h)</label>
          <input
            id="field-completed-work"
            type="number"
            min={0}
            step="0.5"
            value={completedWork ?? ''}
            onChange={(e) => setCompletedWork(e.target.value ? parseFloat(e.target.value) : undefined)}
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
            placeholder="e.g. 4"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="field-start-date" className="text-[13px] font-medium text-[var(--text-secondary)]">Start Date</label>
          <input
            id="field-start-date"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setDateError(null);
            }}
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="field-target-date" className="text-[13px] font-medium text-[var(--text-secondary)]">Target Date</label>
          <input
            id="field-target-date"
            type="date"
            value={targetDate}
            onChange={(e) => {
              setTargetDate(e.target.value);
              setDateError(null);
            }}
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
          />
        </div>
      </div>
      {dateError && <p className="text-xs text-red-500 font-medium">{dateError}</p>}

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
