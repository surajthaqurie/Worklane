'use client';

import React, { useState } from 'react';
import { Bookmark, X, Trash2, Check, Plus, Folder } from 'lucide-react';
import { useAnalyticsFilters, useCreateSavedReport, useDeleteSavedReport, useSavedReports } from '../hooks/useAnalytics';

interface SavedReportsModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SavedReportsModal({ projectId, isOpen, onClose }: SavedReportsModalProps) {
  const { data: savedReports = [], isLoading } = useSavedReports(projectId);
  const createReport = useCreateSavedReport(projectId);
  const deleteReport = useDeleteSavedReport(projectId);
  const { filters, updateFilters } = useAnalyticsFilters();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleSaveCurrent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await createReport.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      reportType: filters.view || 'overview',
      filters: filters as Record<string, unknown>,
      isShared: true,
    });

    setName('');
    setDescription('');
    setIsCreating(false);
  };

  const handleLoadReport = (report: (typeof savedReports)[0]) => {
    if (report.filters) {
      updateFilters(report.filters as Record<string, any>);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] max-w-lg w-full p-6 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-amber-500" aria-hidden />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Saved Reports
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded focus-ring"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        {/* Action button */}
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] hover:opacity-90 transition-opacity focus-ring"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden />
            <span>Save Current Filters as Report</span>
          </button>
        )}

        {/* Creation Form */}
        {isCreating && (
          <form onSubmit={handleSaveCurrent} className="bg-[var(--bg-surface-hover)] p-3 rounded border border-[var(--border-subtle)] space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Report Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Backend Bugs — Sprint 12"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded focus-ring text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Description (Optional)
              </label>
              <input
                type="text"
                placeholder="Brief summary of this report scope"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-2.5 py-1.5 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded focus-ring text-[var(--text-primary)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createReport.isPending}
                className="px-3 py-1 text-[12px] bg-[var(--brand-primary)] text-white rounded hover:opacity-90 disabled:opacity-50"
              >
                {createReport.isPending ? 'Saving...' : 'Save Report'}
              </button>
            </div>
          </form>
        )}

        {/* List of saved reports */}
        <div className="max-h-60 overflow-y-auto divide-y divide-[var(--border-subtle)]">
          {isLoading ? (
            <div className="py-6 text-center text-xs text-[var(--text-muted)]">
              Loading saved reports...
            </div>
          ) : savedReports.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--text-muted)]">
              No saved reports yet. Save your current filter parameters above.
            </div>
          ) : (
            savedReports.map((report) => (
              <div
                key={report.id}
                className="py-2.5 flex items-center justify-between gap-3 group hover:bg-[var(--bg-surface-hover)] px-2 rounded transition-colors"
              >
                <div
                  onClick={() => handleLoadReport(report)}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Folder className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0" aria-hidden />
                    <span className="text-[13px] font-medium text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">
                      {report.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface-hover)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] uppercase">
                      {report.reportType}
                    </span>
                  </div>
                  {report.description && (
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-1 pl-5">
                      {report.description}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => deleteReport.mutate(report.id)}
                  title="Delete Report"
                  className="p-1 text-[var(--text-muted)] hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100 focus-ring"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
