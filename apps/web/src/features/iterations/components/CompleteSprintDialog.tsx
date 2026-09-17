'use client';

import React, { useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Iteration } from '@/shared/types/iterations';
import { useCompleteIteration } from '../hooks/useIterations';
import { Modal } from '@/shared/components/ui/Modal';
import { formatApiError } from '@/shared/utils/error';

export interface CompleteSprintDialogProps {
  projectId: string;
  iteration: Iteration;
  iterations: Iteration[];
  isOpen: boolean;
  onClose: () => void;
  incompleteCount?: number;
  workItemsCount?: number;
  doneWorkItemsCount?: number;
}

export function CompleteSprintDialog({
  projectId,
  iteration,
  iterations,
  isOpen,
  onClose,
  incompleteCount,
  workItemsCount,
  doneWorkItemsCount,
}: CompleteSprintDialogProps) {
  const completeMutation = useCompleteIteration(projectId);

  const incomplete = incompleteCount ?? iteration.incompleteCount ?? 0;
  const total = workItemsCount ?? iteration.workItemCount ?? 0;
  const done = doneWorkItemsCount ?? 0;

  const [action, setAction] = useState<'MOVE_TO_NEXT' | 'MOVE_TO_BACKLOG'>('MOVE_TO_BACKLOG');
  const [targetId, setTargetId] = useState(iterations.find((i) => i.status === 'PLANNED')?.id ?? '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleComplete = async () => {
    setError('');
    if (action === 'MOVE_TO_NEXT' && !targetId) {
      setError('Please select a target sprint.');
      return;
    }
    try {
      await completeMutation.mutateAsync({
        iterationId: iteration.id,
        moveRemainingToIterationId: action === 'MOVE_TO_NEXT' ? targetId : null,
      });
      setSuccess('Sprint completed successfully.');
      setTimeout(onClose, 1500);
    } catch (err: unknown) {
      setError(formatApiError(err));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Complete Sprint">
      <div className="flex flex-col gap-4">
        <div className="bg-[var(--bg-surface-hover)] rounded-[var(--radius-card)] p-4">
          <p className="text-[14px] font-semibold text-[var(--text-primary)]">{iteration.name}</p>
          <div className="mt-1 flex items-center gap-3 text-[12px] text-[var(--text-secondary)]">
            <span>{total} total items</span>
            <span>·</span>
            <span className="text-[var(--iteration-completed)]">{done} done</span>
            {incomplete > 0 && (
              <>
                <span>·</span>
                <span className="text-[var(--priority-medium)]">{incomplete} incomplete</span>
              </>
            )}
          </div>
        </div>

        {incomplete === 0 ? (
          <div className="flex items-center gap-2 text-[13px] text-[var(--iteration-completed)] font-medium">
            <CheckCircle2 className="w-4 h-4" />
            All items are done! Ready to complete this sprint.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-[var(--text-secondary)]">
              <strong>{incomplete}</strong> incomplete {incomplete === 1 ? 'item' : 'items'} will be:
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
                <p className="text-[13px] font-medium text-[var(--text-primary)]">Move to backlog</p>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                  Items will have no sprint assigned
                </p>
              </div>
            </label>

            {iterations.some((i) => i.status === 'PLANNED') && (
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
                  <p className="text-[13px] font-medium text-[var(--text-primary)]">Move to next sprint</p>
                  {action === 'MOVE_TO_NEXT' && (
                    <select
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      className="mt-2 w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-1.5 text-[12px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
                    >
                      <option value="">Select a sprint…</option>
                      {iterations
                        .filter((i) => i.status === 'PLANNED')
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
            className="px-4 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleComplete}
            disabled={completeMutation.isPending}
            className="px-4 py-2 bg-[var(--iteration-completed)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {completeMutation.isPending ? 'Completing...' : 'Complete Sprint'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
