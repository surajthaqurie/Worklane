'use client';

import React, { useState } from 'react';
import {
  useWorkItemStates,
  useCreateWorkItemState,
  useUpdateWorkItemState,
  useDeleteWorkItemState,
  useReorderWorkItemStates,
  WorkItemState,
} from '@/hooks/useWorkItemStates';
import { Settings2, X, Plus, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';

const PRESET_COLORS = [
  '#94A3B8',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#14B8A6',
  '#F97316',
  '#6366F1',
];

export function StatesManager({ projectId }: { projectId: string }) {
  const { data: states = [] } = useWorkItemStates(projectId);
  const createState = useCreateWorkItemState(projectId);
  const updateState = useUpdateWorkItemState(projectId);
  const deleteState = useDeleteWorkItemState(projectId);
  const reorderStates = useReorderWorkItemStates(projectId);

  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
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
    const used = states.length;
    if (used <= 1) {
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
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-button)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
        title="Manage board states"
      >
        <Settings2 className="w-4 h-4" /> States
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 transition-opacity backdrop-blur-[1px]"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-0 m-auto w-full max-w-lg h-fit max-h-[90vh] bg-[var(--bg-surface)] shadow-2xl z-50 rounded-[var(--radius-card)] flex flex-col border border-[var(--border-subtle)] overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-[var(--border-subtle)]">
              <div>
                <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Board States</h2>
                <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                  Columns shown on the board, in order. Mark states as <span className="font-medium">Done</span> to count toward completion.
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 bg-[var(--bg-surface-hover)] rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
              {states.map((state, index) => (
                <div
                  key={state.id}
                  className="flex items-center gap-2 p-3 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)]"
                >
                  <select
                    value={state.color}
                    onChange={(e) => updateState.mutate({ id: state.id, data: { color: e.target.value } })}
                    className="w-8 h-8 rounded-full cursor-pointer border border-[var(--border-default)]"
                    style={{ backgroundColor: state.color }}
                    title="State color"
                  >
                    {PRESET_COLORS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

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
                    className="flex-1 min-w-0 border border-transparent hover:border-[var(--border-default)] focus:border-[var(--border-focus)] rounded-[var(--radius-input)] px-2 py-1 text-[13px] bg-transparent focus:bg-[var(--bg-surface)] focus:outline-none transition-colors"
                  />

                  <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)] cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={state.isDone}
                      onChange={(e) => updateState.mutate({ id: state.id, data: { isDone: e.target.checked } })}
                      className="w-3.5 h-3.5 accent-[var(--iteration-completed)] cursor-pointer"
                    />
                    Done
                  </label>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
                      title="Move up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMove(index, 1)}
                      disabled={index === states.length - 1}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
                      title="Move down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleDelete(state)}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--priority-high)] transition-colors shrink-0"
                    title="Delete state"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="flex items-end gap-2 p-3 border border-dashed border-[var(--border-strong)] rounded-[var(--radius-card)] bg-[var(--bg-surface-hover)]">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[11px] font-medium text-[var(--text-secondary)]">New state name</label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="e.g. In Review"
                    className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-1.5 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                  />
                </div>
                <div className="flex items-center gap-1.5 pb-2">
                  <select
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-7 h-7 rounded-full cursor-pointer border border-[var(--border-default)]"
                    style={{ backgroundColor: newColor }}
                    title="Color"
                  >
                    {PRESET_COLORS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newIsDone}
                      onChange={(e) => setNewIsDone(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[var(--iteration-completed)] cursor-pointer"
                    />
                    Done
                  </label>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || createState.isPending}
                  className="px-3 py-1.5 bg-[var(--brand-primary)] text-white text-[12px] font-medium rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}