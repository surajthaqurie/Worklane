'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useIterations, useCreateIteration, useUpdateIteration, useDeleteIteration, Iteration } from '@/hooks/useIterations';
import { format, differenceInCalendarDays } from 'date-fns';
import { CalendarDays, Trash2, Rocket, CheckCircle2, Target, X, PlayCircle } from 'lucide-react';

const STATE_CONFIG: Record<Iteration['state'], { label: string; className: string }> = {
  PLANNED: { label: 'Planned', className: 'bg-[var(--iteration-planned)]/15 text-[var(--iteration-planned)]' },
  ACTIVE:  { label: 'Active',  className: 'bg-[var(--iteration-active)]/15 text-[var(--iteration-active)]' },
  COMPLETED: { label: 'Completed', className: 'bg-[var(--iteration-completed)]/15 text-[var(--iteration-completed)]' },
};

export function Iterations({ projectId }: { projectId: string }) {
  const { data: iterations = [], isLoading, error, refetch } = useIterations(projectId);
  const createIteration = useCreateIteration(projectId);
  const updateIteration = useUpdateIteration(projectId);
  const deleteIteration = useDeleteIteration(projectId);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', goal: '', startDate: '', endDate: '' });

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const defaultEnd = format(new Date(today.getTime() + 14 * 86400000), 'yyyy-MM-dd');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.startDate || !form.endDate) return;
    if (form.endDate < form.startDate) {
      alert('End date must be after start date.');
      return;
    }
    await createIteration.mutateAsync({
      name: form.name.trim(),
      goal: form.goal.trim() || undefined,
      startDate: new Date(form.startDate + 'T00:00:00.000Z').toISOString(),
      endDate: new Date(form.endDate + 'T00:00:00.000Z').toISOString(),
    });
    setShowCreate(false);
    setForm({ name: '', goal: '', startDate: '', endDate: '' });
  };

  const handleStateChange = async (iteration: Iteration, newState: 'ACTIVE' | 'COMPLETED') => {
    try {
      await updateIteration.mutateAsync({ id: iteration.id, data: { state: newState } });
    } catch {
      if (newState === 'ACTIVE') {
        alert('Could not start iteration. Only one active iteration is allowed per project.');
      }
    }
  };

  const handleDelete = async (iteration: Iteration) => {
    if (!window.confirm(`Delete iteration "${iteration.name}"? Work items will be moved back to the backlog.`)) return;
    await deleteIteration.mutateAsync(iteration.id);
  };

  const openCreateModal = () => {
    setForm({ name: '', goal: '', startDate: todayStr, endDate: defaultEnd });
    setShowCreate(true);
  };

  if (isLoading) return <div className="p-8 text-[13px] text-[var(--text-muted)]">Loading iterations...</div>;
  if (error) {
    return (
      <div className="p-8 flex flex-col items-start gap-3">
        <p className="text-[13px] text-[var(--priority-high)]">Failed to load iterations</p>
        <p className="text-[12px] text-[var(--text-muted)]">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 text-[12px] font-medium text-[var(--text-primary)] border border-[var(--border-default)] rounded-[var(--radius-button)] hover:bg-[var(--bg-surface-hover)] transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-4 border-b border-[var(--border-subtle)] shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">Iterations</h1>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Plan and time-box iterations of work.</p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0 gap-3">
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors"
          >
            + New Iteration
          </button>
        </div>
      </div>

      {iterations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[var(--border-strong)] rounded-[var(--radius-card)] bg-[var(--bg-surface-hover)]">
          <Rocket className="w-8 h-8 text-[var(--text-muted)] mb-3" />
          <p className="text-[15px] font-medium text-[var(--text-secondary)]">No iterations yet</p>
          <p className="text-[13px] text-[var(--text-muted)] mt-1 mb-4">Create your first iteration to start planning work.</p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors"
          >
            + New Iteration
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {iterations.map((iteration) => {
            const counts = (iteration.workItemsCount ?? 0);
            const done = (iteration.doneWorkItemsCount ?? 0);
            const pct = counts > 0 ? Math.round((done / counts) * 100) : 0;
            const daysLeft = differenceInCalendarDays(new Date(iteration.endDate), new Date());
            const isActive = iteration.state === 'ACTIVE';
            const isCompleted = iteration.state === 'COMPLETED';

            return (
              <div
                key={iteration.id}
                className={`border rounded-[var(--radius-card)] bg-[var(--bg-surface)] overflow-hidden transition-colors ${
                  isActive
                    ? 'border-[var(--iteration-active)]/40'
                    : isCompleted
                    ? 'border-[var(--border-subtle)]'
                    : 'border-[var(--border-default)]'
                }`}
              >
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Link
                        href={`/projects/${projectId}/iterations/${iteration.id}`}
                        className="text-[16px] font-semibold text-[var(--text-primary)] hover:text-[var(--brand-primary)] transition-colors truncate"
                      >
                        {iteration.name}
                      </Link>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATE_CONFIG[iteration.state].className}`}>
                        {STATE_CONFIG[iteration.state].label}
                      </span>
                    </div>

                    {iteration.goal && (
                      <p className="text-[13px] text-[var(--text-secondary)] line-clamp-2 flex items-start gap-1.5">
                        <Target className="w-3.5 h-3.5 mt-[3px] shrink-0 text-[var(--text-muted)]" />
                        {iteration.goal}
                      </p>
                    )}

                    <div className="flex items-center gap-4 mt-1 text-[12px] text-[var(--text-muted)]">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {format(new Date(iteration.startDate), 'MMM d, yyyy')} — {format(new Date(iteration.endDate), 'MMM d, yyyy')}
                      </span>
                      {iteration.state === 'ACTIVE' && daysLeft >= 0 && (
                        <span className="font-medium text-[var(--iteration-active)]">{daysLeft} days left</span>
                      )}
                      {iteration.state === 'ACTIVE' && daysLeft < 0 && (
                        <span className="font-medium text-[var(--priority-high)]">{Math.abs(daysLeft)} days overdue</span>
                      )}
                      <span>{counts} {counts === 1 ? 'item' : 'items'} · {done} done</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 sm:min-w-[200px]">
                    <div className="w-full">
                      <div className="flex justify-between text-[12px] mb-1">
                        <span className="text-[var(--text-muted)]">Progress</span>
                        <span className={`font-medium ${counts === 0 ? 'text-[var(--text-muted)]' : pct === 100 ? 'text-[var(--iteration-completed)]' : 'text-[var(--text-secondary)]'}`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full overflow-hidden bg-[var(--bg-surface-hover)]">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${pct === 100 ? 'bg-[var(--iteration-completed)]' : 'bg-[var(--iteration-active)]'}`}
                          style={{ width: `${counts === 0 ? 0 : pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/projects/${projectId}/iterations/${iteration.id}`}
                        className="px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-surface-selected)] rounded-[var(--radius-button)] transition-colors"
                      >
                        View
                      </Link>
                      {iteration.state === 'PLANNED' && (
                        <button
                          onClick={() => handleStateChange(iteration, 'ACTIVE')}
                          className="px-3 py-1.5 text-[12px] font-medium text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] rounded-[var(--radius-button)] transition-colors flex items-center gap-1.5"
                          disabled={updateIteration.isPending}
                        >
                          <PlayCircle className="w-3.5 h-3.5" /> Start
                        </button>
                      )}
                      {iteration.state === 'ACTIVE' && (
                        <button
                          onClick={() => handleStateChange(iteration, 'COMPLETED')}
                          className="px-3 py-1.5 text-[12px] font-medium text-white bg-[var(--iteration-completed)] hover:bg-[#0ea5e9] rounded-[var(--radius-button)] transition-colors flex items-center gap-1.5"
                          disabled={updateIteration.isPending}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(iteration)}
                        disabled={deleteIteration.isPending}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--priority-high)] hover:bg-[var(--priority-high)]/10 rounded-[var(--radius-button)] transition-colors"
                        title="Delete iteration"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 transition-opacity backdrop-blur-[1px]"
            onClick={() => setShowCreate(false)}
          />
          <div className="fixed inset-0 m-auto w-full max-w-md h-fit max-h-[90vh] bg-[var(--bg-surface)] shadow-2xl z-50 rounded-[var(--radius-card)] flex flex-col border border-[var(--border-subtle)] overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-[var(--border-subtle)]">
              <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">New Iteration</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 bg-[var(--bg-surface-hover)] rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 flex flex-col gap-4 overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--text-secondary)]">Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                  placeholder="e.g. Iteration 1"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--text-secondary)]">Goal</label>
                <input
                  type="text"
                  value={form.goal}
                  onChange={(e) => setForm({ ...form, goal: e.target.value })}
                  className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                  placeholder="What will this iteration achieve?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[var(--text-secondary)]">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[var(--text-secondary)]">End Date *</label>
                  <input
                    type="date"
                    required
                    value={form.endDate}
                    min={form.startDate || undefined}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createIteration.isPending}
                  className="px-4 py-2 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors"
                >
                  {createIteration.isPending ? 'Creating...' : 'Create Iteration'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
