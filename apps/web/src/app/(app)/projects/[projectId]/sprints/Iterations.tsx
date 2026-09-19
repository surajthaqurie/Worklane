'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { format, differenceInCalendarDays } from 'date-fns';
import { CalendarDays, Trash2, Rocket, Target, PlayCircle, CheckCircle2, Pencil } from 'lucide-react';
import {
  useIterations,
  useCreateIteration,
  useUpdateIteration,
  useActivateIteration,
  useDeleteIteration,
} from '@/features/iterations/hooks/useIterations';
import { Iteration } from '@/shared/types/iterations';
import { CompleteSprintDialog } from '@/features/iterations/components/CompleteSprintDialog';
import { Modal } from '@/shared/components/ui/Modal';
import { Spinner, ErrorState } from '@/shared/components/ui';
import { useProjectContext } from '@/app/(app)/projects/[projectId]/project-layout-client';

const STATE_CONFIG: Record<
  Iteration['status'] | string,
  { label: string; dotClass: string; badgeClass: string }
> = {
  PLANNED: {
    label: 'Planned',
    dotClass: 'bg-[var(--iteration-planned)]',
    badgeClass: 'bg-[var(--iteration-planned)]/15 text-[var(--iteration-planned)] border border-[var(--iteration-planned)]/30',
  },
  ACTIVE: {
    label: 'Active',
    dotClass: 'bg-[var(--iteration-active)]',
    badgeClass: 'bg-[var(--iteration-active)]/15 text-[var(--iteration-active)] border border-[var(--iteration-active)]/30',
  },
  COMPLETED: {
    label: 'Completed',
    dotClass: 'bg-[var(--iteration-completed)]',
    badgeClass: 'bg-[var(--iteration-completed)]/15 text-[var(--iteration-completed)] border border-[var(--iteration-completed)]/30',
  },
};

export function Iterations({ projectId }: { projectId: string }) {
  const { selectedTeamId } = useProjectContext();
  const { data: iterations = [], isLoading, error, refetch } = useIterations(projectId, selectedTeamId);
  const createIteration = useCreateIteration(projectId);
  const updateIteration = useUpdateIteration(projectId);
  const activateIteration = useActivateIteration(projectId);
  const deleteIteration = useDeleteIteration(projectId);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    goal: '',
    startDate: '',
    endDate: '',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    goal: '',
    startDate: '',
    endDate: '',
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [completingIteration, setCompletingIteration] = useState<Iteration | null>(null);

  const openCreate = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const defaultEnd = format(new Date(Date.now() + 14 * 86400000), 'yyyy-MM-dd');
    setCreateForm({ name: '', goal: '', startDate: todayStr, endDate: defaultEnd });
    setShowCreate(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.startDate || !createForm.endDate) return;

    createIteration.mutate(
      {
        name: createForm.name.trim(),
        goal: createForm.goal.trim() || undefined,
        startDate: new Date(createForm.startDate + 'T00:00:00.000Z').toISOString(),
        endDate: new Date(createForm.endDate + 'T00:00:00.000Z').toISOString(),
      },
      {
        onSuccess: () => setShowCreate(false),
      }
    );
  };

  const startEdit = (iteration: Iteration) => {
    setEditingId(iteration.id);
    setEditForm({
      name: iteration.name,
      goal: iteration.goal ?? '',
      startDate: iteration.startDate ? format(new Date(iteration.startDate), 'yyyy-MM-dd') : '',
      endDate: iteration.endDate ? format(new Date(iteration.endDate), 'yyyy-MM-dd') : '',
    });
  };

  const saveEdit = (id: string) => {
    updateIteration.mutate(
      {
        iterationId: id,
        data: {
          name: editForm.name.trim(),
          goal: editForm.goal.trim() || null,
          startDate: editForm.startDate ? new Date(editForm.startDate + 'T00:00:00.000Z').toISOString() : null,
          endDate: editForm.endDate ? new Date(editForm.endDate + 'T00:00:00.000Z').toISOString() : null,
        },
      },
      {
        onSuccess: () => setEditingId(null),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => refetch()} title="Failed to load sprints" />;
  }

  return (
    <div className="flex flex-col w-full h-full p-6">
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
          className="mt-4 md:mt-0 px-4 py-2 bg-[var(--brand-primary)] hover:opacity-90 text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors"
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
            className="px-4 py-2 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:opacity-90"
          >
            + New Sprint
          </button>
        </div>
      )}

      {/* Sprint list */}
      <div className="flex flex-col gap-4 overflow-y-auto">
        {iterations.map((iteration) => {
          const status = iteration.status || iteration.state || 'PLANNED';
          const total = iteration.workItemCount ?? 0;
          const daysLeft = iteration.endDate
            ? differenceInCalendarDays(new Date(iteration.endDate), new Date())
            : 0;
          const isActive = status === 'ACTIVE';
          const isCompleted = status === 'COMPLETED';
          const isEditing = editingId === iteration.id;
          const stateCfg = STATE_CONFIG[status] || STATE_CONFIG.PLANNED;

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
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[12px] font-medium text-[var(--text-secondary)]">Name</label>
                            <input
                              autoFocus
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-1.5 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[12px] font-medium text-[var(--text-secondary)]">Goal</label>
                            <input
                              value={editForm.goal}
                              onChange={(e) => setEditForm({ ...editForm, goal: e.target.value })}
                              className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-1.5 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                              placeholder="Sprint goal"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[12px] font-medium text-[var(--text-secondary)]">Start Date</label>
                            <input
                              type="date"
                              value={editForm.startDate}
                              onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                              className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-1.5 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[12px] font-medium text-[var(--text-secondary)]">End Date</label>
                            <input
                              type="date"
                              value={editForm.endDate}
                              onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                              className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-1.5 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => saveEdit(iteration.id)}
                            disabled={updateIteration.isPending}
                            className="px-3 py-1.5 bg-[var(--brand-primary)] text-white text-[12px] font-medium rounded-[var(--radius-button)] hover:opacity-90 disabled:opacity-50"
                          >
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
                        <div className="flex items-center gap-2.5 flex-wrap mb-1">
                          <Link
                            href={`/projects/${projectId}/sprints/${iteration.id}`}
                            className="text-[16px] font-semibold text-[var(--text-primary)] hover:text-[var(--brand-primary)] transition-colors"
                          >
                            {iteration.name}
                          </Link>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${stateCfg.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${stateCfg.dotClass}`} />
                            {stateCfg.label}
                          </span>
                        </div>

                        {iteration.goal && (
                          <p className="text-[13px] text-[var(--text-secondary)] flex items-start gap-1.5 mb-2">
                            <Target className="w-3.5 h-3.5 mt-[2px] shrink-0 text-[var(--text-muted)]" />
                            {iteration.goal}
                          </p>
                        )}

                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--text-muted)] mt-1">
                          {iteration.startDate && iteration.endDate && (
                            <span className="flex items-center gap-1.5">
                              <CalendarDays className="w-3.5 h-3.5" />
                              {format(new Date(iteration.startDate), 'MMM d, yyyy')} —{' '}
                              {format(new Date(iteration.endDate), 'MMM d, yyyy')}
                            </span>
                          )}
                          {isActive && daysLeft >= 0 && (
                            <span className="font-medium text-[var(--iteration-active)]">
                              {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                            </span>
                          )}
                          <span>
                            {total} {total === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions column */}
                  {!isEditing && (
                    <div className="flex items-center gap-2 shrink-0">
                      {status === 'PLANNED' && (
                        <button
                          onClick={() => activateIteration.mutate(iteration.id)}
                          disabled={activateIteration.isPending || iterations.some((it) => it.status === 'ACTIVE')}
                          title={
                            iterations.some((it) => it.status === 'ACTIVE')
                              ? 'Sprint active. Complete the current active sprint before starting another one.'
                              : undefined
                          }
                          className="px-3 py-1.5 text-[12px] font-medium text-white bg-[var(--brand-primary)] hover:opacity-90 rounded-[var(--radius-button)] transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          {activateIteration.isPending && activateIteration.variables === iteration.id ? 'Starting...' : 'Start Sprint'}
                        </button>
                      )}
                      {status === 'ACTIVE' && (
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
                      {confirmDeleteId === iteration.id ? (
                        <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-rose-500/30 rounded-[var(--radius-button)] px-2 py-1">
                          <span className="text-[11px] text-rose-500">Delete?</span>
                          <button
                            onClick={() => deleteIteration.mutate(iteration.id)}
                            disabled={deleteIteration.isPending}
                            className="text-[11px] font-medium text-rose-500 hover:underline"
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
                          className="p-1.5 text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-[var(--radius-button)] transition-colors"
                          title="Delete sprint"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Sprint">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--text-secondary)]">Name *</label>
            <input
              type="text"
              required
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
              placeholder="e.g. Sprint 1"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--text-secondary)]">Goal</label>
            <input
              type="text"
              value={createForm.goal}
              onChange={(e) => setCreateForm({ ...createForm, goal: e.target.value })}
              className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
              placeholder="What will this sprint achieve?"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[var(--text-secondary)]">Start Date *</label>
              <input
                type="date"
                required
                value={createForm.startDate}
                onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[var(--text-secondary)]">End Date *</label>
              <input
                type="date"
                required
                value={createForm.endDate}
                min={createForm.startDate || undefined}
                onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          </div>
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
              className="px-4 py-2 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:opacity-90 disabled:opacity-50"
            >
              {createIteration.isPending ? 'Creating...' : 'Create Sprint'}
            </button>
          </div>
        </form>
      </Modal>

      {completingIteration && (
        <CompleteSprintDialog
          projectId={projectId}
          iteration={completingIteration}
          iterations={iterations.filter((it) => it.status !== 'COMPLETED' && it.id !== completingIteration.id)}
          isOpen={!!completingIteration}
          onClose={() => setCompletingIteration(null)}
        />
      )}
    </div>
  );
}
