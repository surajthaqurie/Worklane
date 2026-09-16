'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { format, differenceInCalendarDays } from 'date-fns';
import {
  CalendarDays,
  Trash2,
  Rocket,
  Target,
  X,
  PlayCircle,
  CheckCircle2,
  Pencil,
  ChevronDown,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  Iteration,
  useIterations,
  useCreateIteration,
  useUpdateIteration,
  useActivateIteration,
  useCompleteIteration,
  useDeleteIteration,
} from '@/hooks/useIterations';

// ─── State config ─────────────────────────────────────────────────────────────

const STATE_CONFIG: Record<
  Iteration['state'],
  { label: string; dotClass: string; badgeClass: string }
> = {
  PLANNED: {
    label: 'Planned',
    dotClass: 'bg-[var(--iteration-planned)]',
    badgeClass:
      'bg-[var(--iteration-planned)]/15 text-[var(--iteration-planned)] border border-[var(--iteration-planned)]/30',
  },
  ACTIVE: {
    label: 'Active',
    dotClass: 'bg-[var(--iteration-active)]',
    badgeClass:
      'bg-[var(--iteration-active)]/15 text-[var(--iteration-active)] border border-[var(--iteration-active)]/30',
  },
  COMPLETED: {
    label: 'Completed',
    dotClass: 'bg-[var(--iteration-completed)]',
    badgeClass:
      'bg-[var(--iteration-completed)]/15 text-[var(--iteration-completed)] border border-[var(--iteration-completed)]/30',
  },
};

// ─── Sprints page ─────────────────────────────────────────────────────────────

export function Iterations({ projectId }: { projectId: string }) {
  const { data: iterations = [], isLoading, error, refetch } = useIterations(projectId);
  const createIteration = useCreateIteration(projectId);
  const updateIteration = useUpdateIteration(projectId);
  const activateIteration = useActivateIteration(projectId);
  const completeIteration = useCompleteIteration(projectId);
  const deleteIteration = useDeleteIteration(projectId);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    goal: '',
    startDate: '',
    endDate: '',
  });
  const [createError, setCreateError] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    goal: '',
    startDate: '',
    endDate: '',
  });
  const [editError, setEditError] = useState('');

  // Delete confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Complete sprint dialog
  const [completingIteration, setCompletingIteration] = useState<Iteration | null>(null);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const defaultEnd = format(new Date(today.getTime() + 14 * 86400000), 'yyyy-MM-dd');

  // ── Create ────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setCreateForm({ name: '', goal: '', startDate: todayStr, endDate: defaultEnd });
    setCreateError('');
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!createForm.name.trim() || !createForm.startDate || !createForm.endDate) return;
    if (createForm.endDate <= createForm.startDate) {
      setCreateError('End date must be after start date.');
      return;
    }
    try {
      await createIteration.mutateAsync({
        name: createForm.name.trim(),
        goal: createForm.goal.trim() || undefined,
        startDate: new Date(createForm.startDate + 'T00:00:00.000Z').toISOString(),
        endDate: new Date(createForm.endDate + 'T00:00:00.000Z').toISOString(),
      });
      setShowCreate(false);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create sprint.');
    }
  };

  // ── Inline Edit ───────────────────────────────────────────────────────────

  const startEdit = (iteration: Iteration) => {
    setEditingId(iteration.id);
    setEditForm({
      name: iteration.name,
      goal: iteration.goal ?? '',
      startDate: format(new Date(iteration.startDate), 'yyyy-MM-dd'),
      endDate: format(new Date(iteration.endDate), 'yyyy-MM-dd'),
    });
    setEditError('');
  };

  const saveEdit = async (id: string) => {
    setEditError('');
    if (editForm.endDate <= editForm.startDate) {
      setEditError('End date must be after start date.');
      return;
    }
    try {
      await updateIteration.mutateAsync({
        id,
        data: {
          name: editForm.name.trim(),
          goal: editForm.goal.trim() || null,
          startDate: new Date(editForm.startDate + 'T00:00:00.000Z').toISOString(),
          endDate: new Date(editForm.endDate + 'T00:00:00.000Z').toISOString(),
        },
      });
      setEditingId(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to save.');
    }
  };

  // ── Activate ──────────────────────────────────────────────────────────────

  const [activateError, setActivateError] = useState<Record<string, string>>({});

  const handleActivate = async (id: string) => {
    setActivateError((prev) => ({ ...prev, [id]: '' }));
    try {
      await activateIteration.mutateAsync(id);
    } catch (err: any) {
      setActivateError((prev) => ({
        ...prev,
        [id]: err.message || 'Could not start sprint.',
      }));
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      await deleteIteration.mutateAsync(id);
      setConfirmDeleteId(null);
    } catch (err: any) {
      // silently fail, iteration is gone
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-[var(--text-muted)]">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[13px]">Loading sprints…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 p-8">
        <p className="text-[13px] text-[var(--priority-high)]">Failed to load sprints</p>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 text-[12px] font-medium border border-[var(--border-default)] rounded-[var(--radius-button)] hover:bg-[var(--bg-surface-hover)]"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 mb-5 border-b border-[var(--border-subtle)] shrink-0">
        <div>
          <h1 className="text-[22px] font-semibold text-[var(--text-primary)]">Sprints</h1>
          <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
            Plan and time-box iterations of work. Assign work items through iteration assignment.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="mt-4 md:mt-0 px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors"
        >
          + New Sprint
        </button>
      </div>

      {/* Empty state */}
      {iterations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[var(--border-strong)] rounded-[var(--radius-card)] bg-[var(--bg-surface)]">
          <Rocket className="w-8 h-8 text-[var(--text-muted)] mb-3" />
          <p className="text-[15px] font-medium text-[var(--text-secondary)]">No sprints yet</p>
          <p className="text-[13px] text-[var(--text-muted)] mt-1 mb-4">
            Create your first sprint to start planning work.
          </p>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)]"
          >
            + New Sprint
          </button>
        </div>
      )}

      {/* Sprint list */}
      <div className="flex flex-col gap-4 overflow-y-auto">
        {iterations.map((iteration) => {
          const total = iteration.workItemsCount ?? 0;
          const done = iteration.doneWorkItemsCount ?? 0;
          const incomplete = iteration.incompleteCount ?? 0;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const daysLeft = differenceInCalendarDays(new Date(iteration.endDate), new Date());
          const isActive = iteration.state === 'ACTIVE';
          const isCompleted = iteration.state === 'COMPLETED';
          const isEditing = editingId === iteration.id;

          return (
            <div
              key={iteration.id}
              className={`border rounded-[var(--radius-card)] bg-[var(--bg-surface)] overflow-hidden transition-colors ${
                isActive
                  ? 'border-[var(--iteration-active)]/40 shadow-sm'
                  : isCompleted
                  ? 'border-[var(--border-subtle)] opacity-80'
                  : 'border-[var(--border-default)]'
              }`}
            >
              <div className="p-5">
                {/* Title row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex flex-col gap-3">
                        {/* Edit form */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                              Name
                            </label>
                            <input
                              autoFocus
                              value={editForm.name}
                              onChange={(e) =>
                                setEditForm({ ...editForm, name: e.target.value })
                              }
                              className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-1.5 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                              Goal
                            </label>
                            <input
                              value={editForm.goal}
                              onChange={(e) =>
                                setEditForm({ ...editForm, goal: e.target.value })
                              }
                              className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-1.5 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                              placeholder="Sprint goal"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                              Start Date
                            </label>
                            <input
                              type="date"
                              value={editForm.startDate}
                              onChange={(e) =>
                                setEditForm({ ...editForm, startDate: e.target.value })
                              }
                              className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-1.5 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                              End Date
                            </label>
                            <input
                              type="date"
                              value={editForm.endDate}
                              min={editForm.startDate}
                              onChange={(e) =>
                                setEditForm({ ...editForm, endDate: e.target.value })
                              }
                              className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-1.5 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                            />
                          </div>
                        </div>
                        {editError && (
                          <div className="flex items-center gap-1.5 text-[12px] text-[var(--priority-high)]">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {editError}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveEdit(iteration.id)}
                            disabled={updateIteration.isPending}
                            className="px-3 py-1.5 bg-[var(--brand-primary)] text-white text-[12px] font-medium rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 flex items-center gap-1"
                          >
                            {updateIteration.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : null}
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Name + badge */}
                        <div className="flex items-center gap-2.5 flex-wrap mb-1">
                          <Link
                            href={`/projects/${projectId}/sprints/${iteration.id}`}
                            className="text-[16px] font-semibold text-[var(--text-primary)] hover:text-[var(--brand-primary)] transition-colors"
                          >
                            {iteration.name}
                          </Link>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              STATE_CONFIG[iteration.state].badgeClass
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                STATE_CONFIG[iteration.state].dotClass
                              }`}
                            />
                            {STATE_CONFIG[iteration.state].label}
                          </span>
                        </div>

                        {/* Goal */}
                        {iteration.goal && (
                          <p className="text-[13px] text-[var(--text-secondary)] flex items-start gap-1.5 mb-2">
                            <Target className="w-3.5 h-3.5 mt-[2px] shrink-0 text-[var(--text-muted)]" />
                            {iteration.goal}
                          </p>
                        )}

                        {/* Date + stats */}
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--text-muted)] mt-1">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {format(new Date(iteration.startDate), 'MMM d, yyyy')} —{' '}
                            {format(new Date(iteration.endDate), 'MMM d, yyyy')}
                          </span>
                          {isActive && daysLeft >= 0 && (
                            <span className="font-medium text-[var(--iteration-active)]">
                              {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                            </span>
                          )}
                          {isActive && daysLeft < 0 && (
                            <span className="font-medium text-[var(--priority-high)]">
                              {Math.abs(daysLeft)} days overdue
                            </span>
                          )}
                          <span>
                            {total} {total === 1 ? 'item' : 'items'} · {done} done
                            {incomplete > 0 && (
                              <span className="text-[var(--priority-medium)]">
                                {' '}
                                · {incomplete} incomplete
                              </span>
                            )}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions column */}
                  {!isEditing && (
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Start/Complete/View */}
                      {iteration.state === 'PLANNED' && (
                        <button
                          onClick={() => handleActivate(iteration.id)}
                          disabled={activateIteration.isPending}
                          className="px-3 py-1.5 text-[12px] font-medium text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] rounded-[var(--radius-button)] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          Start Sprint
                        </button>
                      )}
                      {iteration.state === 'ACTIVE' && (
                        <button
                          onClick={() => setCompletingIteration(iteration)}
                          className="px-3 py-1.5 text-[12px] font-medium text-white bg-[var(--iteration-completed)] hover:opacity-90 rounded-[var(--radius-button)] transition-colors flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Complete Sprint
                        </button>
                      )}
                      <Link
                        href={`/projects/${projectId}/sprints/${iteration.id}`}
                        className="px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-surface-selected)] rounded-[var(--radius-button)] transition-colors"
                      >
                        View
                      </Link>
                      {!isCompleted && (
                        <button
                          onClick={() => startEdit(iteration)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors"
                          title="Edit sprint"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* Delete with inline confirm */}
                      {confirmDeleteId === iteration.id ? (
                        <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--priority-high)]/30 rounded-[var(--radius-button)] px-2 py-1">
                          <span className="text-[11px] text-[var(--priority-high)]">
                            Delete?
                          </span>
                          <button
                            onClick={() => handleDelete(iteration.id)}
                            disabled={deleteIteration.isPending}
                            className="text-[11px] font-medium text-[var(--priority-high)] hover:underline"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(iteration.id)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--priority-high)] hover:bg-[var(--priority-high)]/10 rounded-[var(--radius-button)] transition-colors"
                          title="Delete sprint"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Activate error */}
                {activateError[iteration.id] && (
                  <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--priority-high)]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {activateError[iteration.id]}
                  </div>
                )}

                {/* Progress bar */}
                {!isEditing && total > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-[11px] mb-1.5 text-[var(--text-muted)]">
                      <span>Progress</span>
                      <span
                        className={`font-semibold ${
                          pct === 100
                            ? 'text-[var(--iteration-completed)]'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full overflow-hidden bg-[var(--bg-surface-hover)]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct === 100
                            ? 'bg-[var(--iteration-completed)]'
                            : 'bg-[var(--iteration-active)]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create modal */}
      {showCreate && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[1px]"
            onClick={() => setShowCreate(false)}
          />
          <div className="fixed inset-0 m-auto w-full max-w-md h-fit max-h-[90vh] bg-[var(--bg-surface)] shadow-2xl z-50 rounded-[var(--radius-card)] flex flex-col border border-[var(--border-subtle)] overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-[var(--border-subtle)]">
              <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">New Sprint</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1 rounded-full hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 flex flex-col gap-4 overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--text-secondary)]">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                  placeholder="e.g. Sprint 1"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--text-secondary)]">Goal</label>
                <input
                  type="text"
                  value={createForm.goal}
                  onChange={(e) => setCreateForm({ ...createForm, goal: e.target.value })}
                  className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                  placeholder="What will this sprint achieve?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[var(--text-secondary)]">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.startDate}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, startDate: e.target.value })
                    }
                    className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[var(--text-secondary)]">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.endDate}
                    min={createForm.startDate || undefined}
                    onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                    className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                  />
                </div>
              </div>
              {createError && (
                <div className="flex items-center gap-1.5 text-[12px] text-[var(--priority-high)]">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {createError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createIteration.isPending}
                  className="px-4 py-2 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 flex items-center gap-1.5"
                >
                  {createIteration.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Sprint
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Complete sprint dialog */}
      {completingIteration && (
        <CompleteSprintDialog
          iteration={completingIteration}
          iterations={iterations.filter(
            (it) => it.state !== 'COMPLETED' && it.id !== completingIteration.id,
          )}
          onComplete={completeIteration}
          onClose={() => setCompletingIteration(null)}
        />
      )}
    </div>
  );
}

// ─── Complete Sprint Dialog ───────────────────────────────────────────────────

function CompleteSprintDialog({
  iteration,
  iterations,
  onComplete,
  onClose,
}: {
  iteration: Iteration;
  iterations: Iteration[];
  onComplete: ReturnType<typeof useCompleteIteration>;
  onClose: () => void;
}) {
  const incompleteCount = iteration.incompleteCount ?? 0;
  const [action, setAction] = useState<'MOVE_TO_NEXT' | 'MOVE_TO_BACKLOG'>(
    incompleteCount > 0 ? 'MOVE_TO_BACKLOG' : 'MOVE_TO_BACKLOG',
  );
  const [targetId, setTargetId] = useState(iterations.find((i) => i.state === 'PLANNED')?.id ?? '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleComplete = async () => {
    setError('');
    if (action === 'MOVE_TO_NEXT' && !targetId) {
      setError('Please select a target sprint.');
      return;
    }
    try {
      const result = await onComplete.mutateAsync({
        id: iteration.id,
        incompleteAction: action,
        targetIterationId: action === 'MOVE_TO_NEXT' ? targetId : null,
      });
      setSuccess(
        result.movedCount > 0
          ? `Sprint completed. ${result.movedCount} incomplete item${result.movedCount > 1 ? 's' : ''} moved.`
          : 'Sprint completed successfully.',
      );
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to complete sprint.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-0 m-auto w-full max-w-md h-fit max-h-[90vh] bg-[var(--bg-surface)] shadow-2xl z-50 rounded-[var(--radius-card)] flex flex-col border border-[var(--border-subtle)] overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-[var(--border-subtle)]">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
            Complete Sprint
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          <div className="bg-[var(--bg-surface-hover)] rounded-[var(--radius-card)] p-4">
            <p className="text-[14px] font-semibold text-[var(--text-primary)]">
              {iteration.name}
            </p>
            <div className="mt-1 flex items-center gap-3 text-[12px] text-[var(--text-secondary)]">
              <span>{iteration.workItemsCount ?? 0} total items</span>
              <span>·</span>
              <span className="text-[var(--iteration-completed)]">
                {iteration.doneWorkItemsCount ?? 0} done
              </span>
              {incompleteCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-[var(--priority-medium)]">
                    {incompleteCount} incomplete
                  </span>
                </>
              )}
            </div>
          </div>

          {incompleteCount === 0 ? (
            <div className="flex items-center gap-2 text-[13px] text-[var(--iteration-completed)]">
              <CheckCircle2 className="w-4 h-4" />
              All items are done! Ready to complete this sprint.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-[var(--text-secondary)]">
                <strong>{incompleteCount}</strong> incomplete{' '}
                {incompleteCount === 1 ? 'item' : 'items'} will be:
              </p>

              <label className="flex items-start gap-3 p-3 border rounded-[var(--radius-card)] cursor-pointer hover:bg-[var(--bg-surface-hover)] transition-colors border-[var(--border-default)]">
                <input
                  type="radio"
                  name="incompleteAction"
                  value="MOVE_TO_BACKLOG"
                  checked={action === 'MOVE_TO_BACKLOG'}
                  onChange={() => setAction('MOVE_TO_BACKLOG')}
                  className="mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-[13px] font-medium text-[var(--text-primary)]">
                    Move to backlog
                  </p>
                  <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                    Items will have no sprint assigned
                  </p>
                </div>
              </label>

              {iterations.some((i) => i.state === 'PLANNED') && (
                <label className="flex items-start gap-3 p-3 border rounded-[var(--radius-card)] cursor-pointer hover:bg-[var(--bg-surface-hover)] transition-colors border-[var(--border-default)]">
                  <input
                    type="radio"
                    name="incompleteAction"
                    value="MOVE_TO_NEXT"
                    checked={action === 'MOVE_TO_NEXT'}
                    onChange={() => setAction('MOVE_TO_NEXT')}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">
                      Move to next sprint
                    </p>
                    {action === 'MOVE_TO_NEXT' && (
                      <select
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                        className="mt-2 w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-1.5 text-[12px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">Select a sprint…</option>
                        {iterations
                          .filter((i) => i.state === 'PLANNED')
                          .map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </label>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--priority-high)]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--iteration-completed)]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {success}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)]"
            >
              Cancel
            </button>
            <button
              onClick={handleComplete}
              disabled={onComplete.isPending}
              className="px-4 py-2 bg-[var(--iteration-completed)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {onComplete.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Complete Sprint
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
