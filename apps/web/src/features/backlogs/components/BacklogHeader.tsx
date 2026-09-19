'use client';

import React from 'react';
import { Search, Plus, Filter, X } from 'lucide-react';
import { Iteration } from '@/shared/types/iterations';
import { WorkItemState } from '@/shared/types/work-items';
import { ProjectMember } from '@/shared/types/projects';

export interface BacklogHeaderProps {
  search: string;
  onSearchChange: (val: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  selectedCount: number;
  onClearSelection: () => void;
  iterations: Iteration[];
  states: WorkItemState[];
  members: ProjectMember[];
  filterType: string;
  onFilterTypeChange: (val: string) => void;
  filterState: string;
  onFilterStateChange: (val: string) => void;
  filterPriority: string;
  onFilterPriorityChange: (val: string) => void;
  filterAssignedTo: string;
  onFilterAssignedToChange: (val: string) => void;
  filterIterationId: string;
  onFilterIterationIdChange: (val: string) => void;
  onBulkAssignIteration: (iterationId: string | null) => void;
  onBulkAssignUser: (userId: string | null) => void;
  onCreateNewItem: () => void;
}

export function BacklogHeader({
  search,
  onSearchChange,
  showFilters,
  onToggleFilters,
  selectedCount,
  onClearSelection,
  iterations,
  states,
  members,
  filterType,
  onFilterTypeChange,
  filterState,
  onFilterStateChange,
  filterPriority,
  onFilterPriorityChange,
  filterAssignedTo,
  onFilterAssignedToChange,
  filterIterationId,
  onFilterIterationIdChange,
  onBulkAssignIteration,
  onBulkAssignUser,
  onCreateNewItem,
}: BacklogHeaderProps) {
  return (
    <div className="flex flex-col gap-3 pb-3 border-b border-[var(--border-subtle)]">
      <div className="flex items-center justify-between gap-4">
        {/* Search & Filter toggle */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search backlog..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] w-60 focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]"
            />
          </div>

          <button
            type="button"
            onClick={onToggleFilters}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-[var(--radius-button)] transition-colors ${
              showFilters
                ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/30'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
          </button>
        </div>

        {/* Action Buttons & Bulk selection bar */}
        <div className="flex items-center gap-2">
          {selectedCount > 0 ? (
            <div className="flex items-center gap-2 bg-[var(--bg-surface-selected)] border border-[var(--brand-primary)]/30 px-3 py-1 rounded-[var(--radius-button)] text-xs">
              <span className="font-semibold text-[var(--brand-primary)]">{selectedCount} selected</span>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  onBulkAssignUser(val === 'unassigned' ? null : val);
                  e.target.value = '';
                }}
                className="text-xs bg-[var(--bg-surface)] border border-[var(--border-default)] rounded px-2 py-0.5 text-[var(--text-primary)]"
              >
                <option value="">Assign to...</option>
                <option value="unassigned">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.userId}>
                    {m.userName}
                  </option>
                ))}
              </select>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  onBulkAssignIteration(val === 'backlog' ? null : val);
                  e.target.value = '';
                }}
                className="text-xs bg-[var(--bg-surface)] border border-[var(--border-default)] rounded px-2 py-0.5 text-[var(--text-primary)]"
              >
                <option value="">Move to Iteration...</option>
                <option value="backlog">Backlog (Unassigned)</option>
                {iterations.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onClearSelection}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onCreateNewItem}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] hover:opacity-90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Work Item
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filter Controls */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <select
            value={filterType}
            onChange={(e) => onFilterTypeChange(e.target.value)}
            className="px-2.5 py-1 text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] text-[var(--text-primary)]"
          >
            <option value="">All Types</option>
            <option value="EPIC">Epic</option>
            <option value="FEATURE">Feature</option>
            <option value="STORY">User Story</option>
            <option value="TASK">Task</option>
            <option value="BUG">Bug</option>
          </select>

          <select
            value={filterState}
            onChange={(e) => onFilterStateChange(e.target.value)}
            className="px-2.5 py-1 text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] text-[var(--text-primary)]"
          >
            <option value="">All States</option>
            {states.map((s) => (
              <option key={s.id} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={filterPriority}
            onChange={(e) => onFilterPriorityChange(e.target.value)}
            className="px-2.5 py-1 text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] text-[var(--text-primary)]"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>

          <select
            value={filterAssignedTo}
            onChange={(e) => onFilterAssignedToChange(e.target.value)}
            className="px-2.5 py-1 text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] text-[var(--text-primary)]"
          >
            <option value="">All Assignees</option>
            <option value="UNASSIGNED">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.userId}>
                {m.userName}
              </option>
            ))}
          </select>

          <select
            value={filterIterationId}
            onChange={(e) => onFilterIterationIdChange(e.target.value)}
            className="px-2.5 py-1 text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] text-[var(--text-primary)]"
          >
            <option value="">All Iterations</option>
            <option value="backlog">Backlog Only</option>
            {iterations.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
