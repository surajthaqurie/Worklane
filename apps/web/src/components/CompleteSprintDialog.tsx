'use client';
import { useState } from 'react';
import {
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Iteration, useCompleteIteration } from '@/hooks/useIterations';

// ─── Complete Sprint Dialog ───────────────────────────────────────────────────

export function CompleteSprintDialog({
  iteration,
  iterations,
  onComplete,
  onClose,
  incompleteCount,
  workItemsCount,
  doneWorkItemsCount,
}: {
  iteration: Iteration;
  iterations: Iteration[];
  onComplete: ReturnType<typeof useCompleteIteration>;
  onClose: () => void;
  incompleteCount?: number;
  workItemsCount?: number;
  doneWorkItemsCount?: number;
}) {
  const incomplete = incompleteCount ?? iteration.incompleteCount ?? 0;
  const total = workItemsCount ?? iteration.workItemsCount ?? 0;
  const done = doneWorkItemsCount ?? iteration.doneWorkItemsCount ?? 0;
  const [action, setAction] = useState<'MOVE_TO_NEXT' | 'MOVE_TO_BACKLOG'>(
    'MOVE_TO_BACKLOG',
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete sprint.');
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
              <span>{total} total items</span>
              <span>·</span>
              <span className="text-[var(--iteration-completed)]">
                {done} done
              </span>
              {incomplete > 0 && (
                <>
                  <span>·</span>
                  <span className="text-[var(--priority-medium)]">
                    {incomplete} incomplete
                  </span>
                </>
              )}
            </div>
          </div>

          {incomplete === 0 ? (
            <div className="flex items-center gap-2 text-[13px] text-[var(--iteration-completed)]">
              <CheckCircle2 className="w-4 h-4" />
              All items are done! Ready to complete this sprint.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-[var(--text-secondary)]">
                <strong>{incomplete}</strong> incomplete{' '}
                {incomplete === 1 ? 'item' : 'items'} will be:
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