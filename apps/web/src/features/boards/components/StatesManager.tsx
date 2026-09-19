'use client';

import React, { useState } from 'react';
import {
  useWorkItemStates,
  useCreateWorkItemState,
  useUpdateWorkItemState,
  useDeleteWorkItemState,
  useReorderWorkItemStates,
} from '@/features/work-items/hooks/useWorkItemStates';
import { WorkItemState } from '@/shared/types/work-items';
import { Modal } from '@/shared/components/ui/Modal';
import { Settings2, Plus, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';

export function StatesTabContent({ projectId }: { projectId: string }) {
  const { data: states = [] } = useWorkItemStates(projectId);
  const createState = useCreateWorkItemState(projectId);
  const updateState = useUpdateWorkItemState(projectId);
  const deleteState = useDeleteWorkItemState(projectId);
  const reorderStates = useReorderWorkItemStates(projectId);

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [newIsDone, setNewIsDone] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createState.mutateAsync({
      name: newName.trim(),
      color: newColor,
      isDone: newIsDone,
    });
    setNewName('');
    setNewIsDone(false);
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= states.length) return;
    const next = [...states];
    [next[index], next[target]] = [next[target], next[index]];
    await reorderStates.mutateAsync(next.map((s) => s.id));
  };

  const handleDelete = async (state: WorkItemState) => {
    if (states.length <= 1) {
      alert('A project must keep at least one state.');
      return;
    }
    if (!window.confirm(`Delete state "${state.name}"? Work items in it will move to the first remaining state.`)) {
      return;
    }
    try {
      await deleteState.mutateAsync(state.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete state');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)]">
          Manage work item workflow states, change state colors, reorder columns, or mark states as <span className="font-semibold text-[var(--text-primary)]">Done</span>.
        </span>
      </div>

      <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
        {states.map((state, index) => (
          <div
            key={state.id}
            className="flex items-center gap-2.5 p-2.5 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)]"
          >
            {/* Native Color Picker */}
            <div
              className="relative flex items-center justify-center w-7 h-7 rounded-full overflow-hidden border border-[var(--border-default)] shadow-xs cursor-pointer shrink-0 transition-transform hover:scale-105"
              style={{ backgroundColor: state.color && state.color.startsWith('#') ? state.color : '#94A3B8' }}
              title="Click to select state color"
            >
              <input
                type="color"
                value={state.color && state.color.startsWith('#') ? state.color : '#94A3B8'}
                onChange={(e) => updateState.mutate({ id: state.id, data: { color: e.target.value } })}
                className="absolute -inset-2 opacity-0 w-[150%] h-[150%] cursor-pointer"
              />
            </div>

            <input
              value={drafts[state.id] ?? state.name}
              onChange={(e) => setDrafts((d) => ({ ...d, [state.id]: e.target.value }))}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value && value !== state.name) {
                  updateState.mutate({ id: state.id, data: { name: value } });
                }
                setDrafts((d) => {
                  const next = { ...d };
                  delete next[state.id];
                  return next;
                });
              }}
              className="flex-1 min-w-0 border border-transparent hover:border-[var(--border-default)] focus:border-[var(--border-focus)] rounded-[var(--radius-input)] px-2 py-1 text-xs font-medium bg-transparent focus:bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none transition-colors"
            />

            <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer shrink-0 select-none">
              <input
                type="checkbox"
                checked={state.isDone}
                onChange={(e) => updateState.mutate({ id: state.id, data: { isDone: e.target.checked } })}
                className="w-3.5 h-3.5 accent-[var(--brand-primary)] cursor-pointer rounded"
              />
              Done
            </label>

            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => handleMove(index, -1)}
                disabled={index === 0}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
                title="Move up"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleMove(index, 1)}
                disabled={index === states.length - 1}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
                title="Move down"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleDelete(state)}
              className="p-1 text-rose-500 hover:text-rose-600 transition-colors shrink-0"
              title="Delete state"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* Add New State */}
        <div className="flex items-center gap-2 p-2.5 border border-dashed border-[var(--border-strong)] rounded-[var(--radius-card)] bg-[var(--bg-surface-hover)]">
          <div
            className="relative flex items-center justify-center w-7 h-7 rounded-full overflow-hidden border border-[var(--border-default)] shadow-xs cursor-pointer shrink-0 transition-transform hover:scale-105"
            style={{ backgroundColor: newColor }}
            title="Click to pick new state color"
          >
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="absolute -inset-2 opacity-0 w-[150%] h-[150%] cursor-pointer"
            />
          </div>

          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="New state name (e.g. In Review)"
            className="flex-1 min-w-0 border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
          />

          <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer shrink-0 select-none">
            <input
              type="checkbox"
              checked={newIsDone}
              onChange={(e) => setNewIsDone(e.target.checked)}
              className="w-3.5 h-3.5 accent-[var(--brand-primary)] cursor-pointer rounded"
            />
            Done
          </label>

          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || createState.isPending}
            className="px-3 py-1 text-xs font-medium bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] hover:opacity-90 disabled:opacity-50 transition-colors flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add State
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatesManager({ projectId }: { projectId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-button)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
        title="Manage board states"
      >
        <Settings2 className="w-4 h-4" /> States
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Workflow States</h2>
            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
              Manage work item states, color indicators, and completion flags.
            </p>
          </div>
        }
        maxWidthClass="max-w-lg"
      >
        <StatesTabContent projectId={projectId} />
      </Modal>
    </>
  );
}
