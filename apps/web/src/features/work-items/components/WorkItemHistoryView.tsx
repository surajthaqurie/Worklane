'use client';

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Clock,
  User as UserIcon,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { useWorkItemHistory } from '../hooks/useWorkItems';
import type { WorkItemHistoryGroup } from '@/shared/types/history';
import type { WorkItemActivity } from '@/shared/types/work-items';

export interface WorkItemHistoryViewProps {
  workItemId: string;
  projectId?: string;
  members?: Array<{ id?: string; userId: string; userName: string; userEmail?: string }>;
  fallbackActivity?: WorkItemActivity[];
}

const FIELD_OPTIONS = [
  { value: '', label: 'All Fields' },
  { value: 'state', label: 'State' },
  { value: 'priority', label: 'Priority' },
  { value: 'assigned_to', label: 'Assignee' },
  { value: 'title', label: 'Title' },
  { value: 'description', label: 'Description' },
  { value: 'points', label: 'Story Points' },
  { value: 'iteration_id', label: 'Iteration' },
  { value: 'area_id', label: 'Area' },
  { value: 'parent_id', label: 'Parent Item' },
  { value: 'tags', label: 'Tags' },
  { value: 'type', label: 'Type' },
  { value: 'remaining_work', label: 'Remaining Work' },
  { value: 'completed_work', label: 'Completed Work' },
  { value: 'start_date', label: 'Start Date' },
  { value: 'target_date', label: 'Target Date' },
];

export function WorkItemHistoryView({
  workItemId,
  members = [],
  fallbackActivity = [],
}: WorkItemHistoryViewProps) {
  const [selectedActor, setSelectedActor] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  const queryParams = useMemo(() => {
    return {
      page,
      limit,
      actorId: selectedActor || undefined,
      field: selectedField || undefined,
      from: startDate ? new Date(startDate).toISOString() : undefined,
      to: endDate ? new Date(`${endDate}T23:59:59.999Z`).toISOString() : undefined,
      order: 'desc' as const,
    };
  }, [page, limit, selectedActor, selectedField, startDate, endDate]);

  const { data, isLoading, isError } = useWorkItemHistory(workItemId, queryParams);

  const hasActiveFilters = Boolean(selectedActor || selectedField || startDate || endDate);

  const handleClearFilters = () => {
    setSelectedActor('');
    setSelectedField('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Convert fallbackActivity to grouped structure if query fails or is empty
  const fallbackGroups = useMemo<WorkItemHistoryGroup[]>(() => {
    if (!fallbackActivity || fallbackActivity.length === 0) return [];
    return fallbackActivity.map((act) => ({
      groupId: act.id,
      changedBy: {
        id: act.actorId,
        name: act.actorName,
        avatarUrl: act.actorAvatarUrl,
      },
      changedAt: act.createdAt,
      summary: act.description,
      items: [
        {
          id: act.id,
          workItemId: act.workItemId,
          action: act.action,
          field: act.field,
          fieldName: act.field ? act.field.replace(/_/g, ' ') : 'General',
          before: act.previousLabel || act.previousValue,
          after: act.newLabel || act.newValue,
          rawBefore: act.previousValue,
          rawAfter: act.newValue,
          changedBy: {
            id: act.actorId,
            name: act.actorName,
            avatarUrl: act.actorAvatarUrl,
          },
          changedAt: act.createdAt,
          description: act.description,
        },
      ],
    }));
  }, [fallbackActivity]);

  const groups = data?.groups?.length ? data.groups : isError ? fallbackGroups : (data?.groups ?? []);
  const total = data?.total ?? (isError ? fallbackGroups.length : 0);
  const totalPages = data?.totalPages ?? Math.ceil(total / limit) ?? 1;

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* Filter Toolbar */}
      <div className="p-3 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
            <Filter className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <span>Filter History</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-[11px] text-[var(--brand-primary)] hover:underline"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Actor Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
              Actor
            </label>
            <select
              value={selectedActor}
              onChange={(e) => {
                setSelectedActor(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-input)] px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
            >
              <option value="">All Actors</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userName}
                </option>
              ))}
            </select>
          </div>

          {/* Field Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
              Field
            </label>
            <select
              value={selectedField}
              onChange={(e) => {
                setSelectedField(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-input)] px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
            >
              {FIELD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: From */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-input)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
            />
          </div>

          {/* Date Range: To */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-input)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* History Content */}
      {isLoading ? (
        <div className="flex flex-col gap-3 py-6">
          <div className="h-14 bg-[var(--bg-surface-subtle)] rounded animate-pulse" />
          <div className="h-14 bg-[var(--bg-surface-subtle)] rounded animate-pulse" />
          <div className="h-14 bg-[var(--bg-surface-subtle)] rounded animate-pulse" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-10 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] flex flex-col items-center justify-center gap-2">
          <Clock className="w-8 h-8 text-[var(--text-muted)] opacity-50" />
          <div className="text-[var(--text-primary)] font-medium">No history entries found</div>
          <div className="text-[var(--text-secondary)] text-[11px]">
            {hasActiveFilters
              ? 'Try adjusting your filters or date range.'
              : 'Changes and updates made to this item will be logged here.'}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-2 text-xs text-[var(--brand-primary)] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        /* Timeline of Grouped Changes */
        <div className="relative border-l-2 border-[var(--border-subtle)] ml-3 pl-5 space-y-6">
          {groups.map((group) => {
            const groupDate = new Date(group.changedAt);
            const isValidDate = !isNaN(groupDate.getTime());
            const formattedDate = isValidDate
              ? format(groupDate, 'MMM d, yyyy · h:mm a')
              : 'Unknown date';

            return (
              <div key={group.groupId} className="relative group/timeline">
                {/* Timeline node */}
                <div className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-[var(--brand-primary)] border-2 border-[var(--bg-surface)] ring-4 ring-[var(--bg-surface-subtle)]" />

                {/* Group Header: Changed By and Changed At */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {group.changedBy.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={group.changedBy.avatarUrl}
                        alt={group.changedBy.name}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[10px] font-medium text-[var(--text-secondary)]">
                        {group.changedBy.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {group.changedBy.name}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {group.summary}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1 font-mono">
                    <Calendar className="w-3 h-3 text-[var(--text-muted)]" />
                    <span>{formattedDate}</span>
                  </div>
                </div>

                {/* Diff Table / Card */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)] text-[10px] uppercase font-semibold text-[var(--text-secondary)]">
                          <th className="py-1.5 px-3">Field</th>
                          <th className="py-1.5 px-3">Before</th>
                          <th className="py-1.5 px-3">After</th>
                          <th className="py-1.5 px-3">Changed By</th>
                          <th className="py-1.5 px-3">Changed At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)] text-[11px]">
                        {group.items.map((item) => (
                          <tr key={item.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                            {/* Field */}
                            <td className="py-2 px-3 font-medium text-[var(--text-primary)] align-top whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[10px]">
                                {item.fieldName || item.field || 'Item'}
                              </span>
                            </td>

                            {/* Before */}
                            <td className="py-2 px-3 align-top">
                              {item.before ? (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 font-mono text-[11px] line-through decoration-rose-500/50 break-all max-w-[200px]">
                                  {item.before}
                                </span>
                              ) : (
                                <span className="text-[var(--text-muted)] italic text-[10px]">
                                  (empty)
                                </span>
                              )}
                            </td>

                            {/* After */}
                            <td className="py-2 px-3 align-top">
                              {item.after ? (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono font-medium text-[11px] break-all max-w-[200px]">
                                  {item.after}
                                </span>
                              ) : (
                                <span className="text-[var(--text-muted)] italic text-[10px]">
                                  (cleared)
                                </span>
                              )}
                            </td>

                            {/* Changed By */}
                            <td className="py-2 px-3 text-[var(--text-secondary)] align-top whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <UserIcon className="w-3 h-3 text-[var(--text-muted)]" />
                                <span>{item.changedBy.name}</span>
                              </div>
                            </td>

                            {/* Changed At */}
                            <td className="py-2 px-3 text-[var(--text-tertiary)] align-top whitespace-nowrap font-mono text-[10px]">
                              {format(new Date(item.changedAt), 'MMM d, h:mm a')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-subtle)]">
          <div className="text-[11px] text-[var(--text-secondary)]">
            Showing <span className="font-semibold text-[var(--text-primary)]">{(page - 1) * limit + 1}</span>–
            <span className="font-semibold text-[var(--text-primary)]">
              {Math.min(page * limit, total)}
            </span>{' '}
            of <span className="font-semibold text-[var(--text-primary)]">{total}</span> records
          </div>

          <div className="flex items-center gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
              <span>Show:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded px-1.5 py-0.5 text-xs text-[var(--text-primary)] focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Page Navigation */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="p-1 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-medium text-[var(--text-primary)] px-2">
                Page {page} of {Math.max(1, totalPages)}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages || isLoading}
                className="p-1 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
