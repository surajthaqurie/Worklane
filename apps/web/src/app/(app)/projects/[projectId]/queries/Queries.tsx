'use client';

import React, { useState, useMemo } from 'react';
import { SearchCheck, Play, Save, Plus, Trash2, Copy, FilterX, Users, User, Clock } from 'lucide-react';
import {
  useQueries,
  useRecentQueries,
  useRunQuery,
  useCreateQuery,
  useUpdateQuery,
  useDeleteQuery,
  useDuplicateQuery,
  DEFAULT_DEFINITION,
} from '@/features/queries/hooks/useQueries';
import { SavedQuery, QueryDefinition, QueryClause, QueryField, QueryOperator } from '@/features/queries/api/queriesApi';
import { WorkItem } from '@/shared/types/work-items';
import { WorkItemDrawer } from '@/features/work-items/components/WorkItemDrawer';
import { QueryResultsTable } from '@/features/queries/components/QueryResultsTable';
import { formatApiError } from '@/shared/utils/error';

const FIELD_OPTIONS: { label: string; value: QueryField; category: string }[] = [
  { label: 'Work Item Key / ID', value: 'key', category: 'General' },
  { label: 'Work Item Type', value: 'type', category: 'General' },
  { label: 'Title', value: 'title', category: 'General' },
  { label: 'Description', value: 'description', category: 'General' },
  { label: 'State', value: 'state', category: 'Status' },
  { label: 'State Category', value: 'stateCategory', category: 'Status' },
  { label: 'Priority', value: 'priority', category: 'Status' },
  { label: 'Severity', value: 'severity', category: 'Status' },
  { label: 'Story Points', value: 'points', category: 'Estimates' },
  { label: 'Remaining Work (h)', value: 'remainingWork', category: 'Estimates' },
  { label: 'Completed Work (h)', value: 'completedWork', category: 'Estimates' },
  { label: 'Assigned To', value: 'assignedTo', category: 'People' },
  { label: 'Created By', value: 'createdBy', category: 'People' },
  { label: 'Iteration / Sprint', value: 'iterationId', category: 'Scope' },
  { label: 'Area Path', value: 'areaId', category: 'Scope' },
  { label: 'Parent ID', value: 'parentId', category: 'Scope' },
  { label: 'Start Date', value: 'startDate', category: 'Dates' },
  { label: 'Target Date', value: 'targetDate', category: 'Dates' },
  { label: 'Created Date', value: 'createdAt', category: 'Dates' },
  { label: 'Updated Date', value: 'updatedAt', category: 'Dates' },
  { label: 'Completed Date', value: 'completedAt', category: 'Dates' },
  { label: 'Tags', value: 'tags', category: 'General' },
];

const OPERATORS_BY_FIELD: Record<QueryField, { label: string; value: QueryOperator }[]> = {
  key: [
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
    { label: 'greater than (>)', value: 'greaterThan' },
    { label: 'greater or equal (>=)', value: 'greaterThanOrEqual' },
    { label: 'less than (<)', value: 'lessThan' },
    { label: 'less or equal (<=)', value: 'lessThanOrEqual' },
    { label: 'in list', value: 'in' },
    { label: 'not in list', value: 'notIn' },
  ],
  type: [
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
    { label: 'in list', value: 'in' },
    { label: 'not in list', value: 'notIn' },
  ],
  title: [
    { label: 'contains', value: 'contains' },
    { label: 'does not contain', value: 'notContains' },
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
  ],
  description: [
    { label: 'contains', value: 'contains' },
    { label: 'does not contain', value: 'notContains' },
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
  ],
  state: [
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
    { label: 'in list', value: 'in' },
    { label: 'not in list', value: 'notIn' },
    { label: 'is empty', value: 'isEmpty' },
    { label: 'is not empty', value: 'isNotEmpty' },
  ],
  stateCategory: [
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
    { label: 'in list', value: 'in' },
    { label: 'not in list', value: 'notIn' },
  ],
  priority: [
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
    { label: 'greater or equal (>=)', value: 'greaterThanOrEqual' },
    { label: 'less or equal (<=)', value: 'lessThanOrEqual' },
    { label: 'in list', value: 'in' },
    { label: 'not in list', value: 'notIn' },
  ],
  severity: [
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
    { label: 'in list', value: 'in' },
    { label: 'not in list', value: 'notIn' },
  ],
  points: [
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
    { label: 'greater than (>)', value: 'greaterThan' },
    { label: 'greater or equal (>=)', value: 'greaterThanOrEqual' },
    { label: 'less than (<)', value: 'lessThan' },
    { label: 'less or equal (<=)', value: 'lessThanOrEqual' },
    { label: 'between', value: 'between' },
    { label: 'is empty', value: 'isEmpty' },
    { label: 'is not empty', value: 'isNotEmpty' },
  ],
  remainingWork: [
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
    { label: 'greater than (>)', value: 'greaterThan' },
    { label: 'greater or equal (>=)', value: 'greaterThanOrEqual' },
    { label: 'less than (<)', value: 'lessThan' },
    { label: 'less or equal (<=)', value: 'lessThanOrEqual' },
    { label: 'between', value: 'between' },
    { label: 'is empty', value: 'isEmpty' },
    { label: 'is not empty', value: 'isNotEmpty' },
  ],
  completedWork: [
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
    { label: 'greater than (>)', value: 'greaterThan' },
    { label: 'greater or equal (>=)', value: 'greaterThanOrEqual' },
    { label: 'less than (<)', value: 'lessThan' },
    { label: 'less or equal (<=)', value: 'lessThanOrEqual' },
    { label: 'between', value: 'between' },
    { label: 'is empty', value: 'isEmpty' },
    { label: 'is not empty', value: 'isNotEmpty' },
  ],
  assignedTo: [
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
    { label: 'in list', value: 'in' },
    { label: 'not in list', value: 'notIn' },
    { label: 'is empty / unassigned', value: 'isEmpty' },
    { label: 'is assigned', value: 'isNotEmpty' },
  ],
  createdBy: [
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
    { label: 'in list', value: 'in' },
    { label: 'not in list', value: 'notIn' },
  ],
  iterationId: [
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
    { label: 'is empty / unassigned', value: 'isEmpty' },
    { label: 'is assigned', value: 'isNotEmpty' },
  ],
  areaId: [
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
    { label: 'in list', value: 'in' },
  ],
  parentId: [
    { label: 'equals (=)', value: 'equals' },
    { label: 'does not equal (≠)', value: 'notEquals' },
    { label: 'is top-level (no parent)', value: 'isEmpty' },
    { label: 'has parent', value: 'isNotEmpty' },
  ],
  startDate: [
    { label: 'after date (>=)', value: 'after' },
    { label: 'before date (<=)', value: 'before' },
    { label: 'between dates', value: 'between' },
    { label: 'equals (=)', value: 'equals' },
    { label: 'is empty', value: 'isEmpty' },
  ],
  targetDate: [
    { label: 'after date (>=)', value: 'after' },
    { label: 'before date (<=)', value: 'before' },
    { label: 'between dates', value: 'between' },
    { label: 'equals (=)', value: 'equals' },
    { label: 'is empty', value: 'isEmpty' },
  ],
  createdAt: [
    { label: 'after date (>=)', value: 'after' },
    { label: 'before date (<=)', value: 'before' },
    { label: 'between dates', value: 'between' },
    { label: 'equals (=)', value: 'equals' },
    { label: 'is empty', value: 'isEmpty' },
  ],
  updatedAt: [
    { label: 'after date (>=)', value: 'after' },
    { label: 'before date (<=)', value: 'before' },
    { label: 'between dates', value: 'between' },
    { label: 'equals (=)', value: 'equals' },
  ],
  completedAt: [
    { label: 'after date (>=)', value: 'after' },
    { label: 'before date (<=)', value: 'before' },
    { label: 'between dates', value: 'between' },
    { label: 'is completed', value: 'isNotEmpty' },
    { label: 'is not completed', value: 'isEmpty' },
  ],
  tags: [
    { label: 'contains tag', value: 'contains' },
    { label: 'does not contain tag', value: 'notContains' },
    { label: 'equals tag', value: 'equals' },
    { label: 'has no tags', value: 'isEmpty' },
    { label: 'has any tags', value: 'isNotEmpty' },
  ],
};

export function Queries({ projectId }: { projectId: string }) {
  const { data: queries = [] } = useQueries(projectId);
  const { data: recent = [] } = useRecentQueries(projectId);
  const runQuery = useRunQuery(projectId);
  const createQuery = useCreateQuery(projectId);
  const updateQuery = useUpdateQuery(projectId);
  const deleteQueryMut = useDeleteQuery(projectId);
  const duplicateQueryMut = useDuplicateQuery(projectId);

  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('New Query');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftIsShared, setDraftIsShared] = useState(false);
  const [draftDef, setDraftDef] = useState<QueryDefinition>(DEFAULT_DEFINITION);
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(null);

  const myQueries = useMemo(() => queries.filter((q) => !q.isShared), [queries]);
  const sharedQueries = useMemo(() => queries.filter((q) => q.isShared), [queries]);

  const results: WorkItem[] = useMemo(() => runQuery.data?.items ?? [], [runQuery.data]);

  const openSavedQuery = (q: SavedQuery) => {
    setSelectedQueryId(q.id);
    setEditing(false);
    setDraftName(q.name);
    setDraftDescription(q.description ?? '');
    setDraftIsShared(q.isShared);
    setDraftDef({ ...DEFAULT_DEFINITION, ...q.definition });
    runQuery.mutate({ id: q.id });
  };

  const startNewQuery = () => {
    setSelectedQueryId(null);
    setEditing(true);
    setDraftName('New Query');
    setDraftDescription('');
    setDraftIsShared(false);
    setDraftDef(DEFAULT_DEFINITION);
  };

  const addFilter = () => {
    const newClause: QueryClause = {
      logicalOperator: draftDef.filters.length === 0 ? 'AND' : 'AND',
      field: 'state',
      operator: 'equals',
      value: 'IN_PROGRESS',
    };
    setDraftDef((prev) => ({
      ...prev,
      filters: [...prev.filters, newClause],
    }));
    setEditing(true);
  };

  const removeFilter = (index: number) => {
    setDraftDef((prev) => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index),
    }));
    setEditing(true);
  };

  const clearFilters = () => {
    setDraftDef((prev) => ({ ...prev, filters: [] }));
    setEditing(true);
  };

  const handleRun = () => {
    if (selectedQueryId && !editing) {
      runQuery.mutate({ id: selectedQueryId });
    } else {
      runQuery.mutate({ definition: draftDef });
    }
  };

  const handleSave = () => {
    if (!draftName.trim()) return;
    if (selectedQueryId) {
      updateQuery.mutate({
        id: selectedQueryId,
        data: {
          name: draftName.trim(),
          description: draftDescription.trim() || null,
          isShared: draftIsShared,
          definition: draftDef,
        },
      });
    } else {
      createQuery.mutate(
        {
          name: draftName.trim(),
          description: draftDescription.trim() || undefined,
          isShared: draftIsShared,
          definition: draftDef,
        },
        {
          onSuccess: (newQuery) => {
            setSelectedQueryId(newQuery.id);
            setEditing(false);
          },
        }
      );
    }
  };

  const handleDuplicate = () => {
    if (!selectedQueryId) return;
    duplicateQueryMut.mutate(selectedQueryId, {
      onSuccess: (newQuery) => {
        openSavedQuery(newQuery);
      },
    });
  };

  return (
    <div className="flex h-full min-h-[600px] gap-6 p-6">
      {/* Sidebar: Saved & Recent Queries */}
      <div className="w-64 shrink-0 flex flex-col gap-6 border-r border-[var(--border-subtle)] pr-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Work Item Queries</h2>
          <button
            onClick={startNewQuery}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] hover:opacity-90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Query
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto">
          {/* My Queries */}
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              <User className="w-3 h-3" /> My Queries ({myQueries.length})
            </span>
            {myQueries.length === 0 ? (
              <span className="text-xs text-[var(--text-muted)] italic py-1">No private queries</span>
            ) : (
              myQueries.map((q) => (
                <button
                  key={q.id}
                  onClick={() => openSavedQuery(q)}
                  className={`flex items-center justify-between px-3 py-2 text-xs rounded-[var(--radius-button)] transition-colors text-left ${
                    selectedQueryId === q.id
                      ? 'bg-[var(--bg-surface-selected)] text-[var(--brand-primary)] font-medium'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="truncate">{q.name}</span>
                </button>
              ))
            )}
          </div>

          {/* Shared Queries */}
          <div className="flex flex-col gap-1 pt-2 border-t border-[var(--border-subtle)]">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              <Users className="w-3 h-3" /> Shared Queries ({sharedQueries.length})
            </span>
            {sharedQueries.length === 0 ? (
              <span className="text-xs text-[var(--text-muted)] italic py-1">No shared queries</span>
            ) : (
              sharedQueries.map((q) => (
                <button
                  key={q.id}
                  onClick={() => openSavedQuery(q)}
                  className={`flex items-center justify-between px-3 py-2 text-xs rounded-[var(--radius-button)] transition-colors text-left ${
                    selectedQueryId === q.id
                      ? 'bg-[var(--bg-surface-selected)] text-[var(--brand-primary)] font-medium'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="truncate">{q.name}</span>
                </button>
              ))
            )}
          </div>

          {/* Recent Queries */}
          {recent.length > 0 && (
            <div className="flex flex-col gap-1 pt-2 border-t border-[var(--border-subtle)]">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                <Clock className="w-3 h-3" /> Recent Queries
              </span>
              {recent.map((q) => (
                <button
                  key={q.id}
                  onClick={() => openSavedQuery(q)}
                  className="flex items-center justify-between px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] text-left truncate"
                >
                  <span className="truncate">{q.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Builder & Results */}
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <SearchCheck className="w-5 h-5 text-[var(--brand-primary)] shrink-0" />
            <div className="flex flex-col flex-1">
              <input
                type="text"
                value={draftName}
                onChange={(e) => {
                  setDraftName(e.target.value);
                  setEditing(true);
                }}
                placeholder="Query Name..."
                className="text-base font-semibold bg-transparent border-b border-transparent focus:border-[var(--border-focus)] outline-none text-[var(--text-primary)]"
              />
              <input
                type="text"
                value={draftDescription}
                onChange={(e) => {
                  setDraftDescription(e.target.value);
                  setEditing(true);
                }}
                placeholder="Add optional description..."
                className="text-xs text-[var(--text-secondary)] bg-transparent outline-none mt-0.5"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={draftIsShared}
                onChange={(e) => {
                  setDraftIsShared(e.target.checked);
                  setEditing(true);
                }}
                className="rounded border-[var(--border-default)] accent-[var(--brand-primary)]"
              />
              Shared query
            </label>

            <button
              onClick={handleRun}
              disabled={runQuery.isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] hover:opacity-90 transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {runQuery.isPending ? 'Running...' : 'Run Query'}
            </button>

            <button
              onClick={handleSave}
              disabled={createQuery.isPending || updateQuery.isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)] rounded-[var(--radius-button)] transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>

            {selectedQueryId && (
              <>
                <button
                  onClick={handleDuplicate}
                  disabled={duplicateQueryMut.isPending}
                  className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] transition-colors"
                  title="Duplicate query"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this saved query?')) {
                      deleteQueryMut.mutate(selectedQueryId, {
                        onSuccess: () => startNewQuery(),
                      });
                    }
                  }}
                  className="p-1.5 text-rose-500 hover:text-rose-600 rounded-[var(--radius-button)] transition-colors"
                  title="Delete query"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Query Clauses Builder */}
        <div className="flex flex-col gap-3 p-4 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-primary)]">Filter Clauses</span>
            <div className="flex items-center gap-3">
              {draftDef.filters.length > 0 && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <FilterX className="w-3.5 h-3.5" /> Clear Filters
                </button>
              )}
              <button
                onClick={addFilter}
                className="flex items-center gap-1 text-xs text-[var(--brand-primary)] font-medium hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add Clause
              </button>
            </div>
          </div>

          {draftDef.filters.length === 0 ? (
            <span className="text-xs text-[var(--text-muted)] italic py-2">
              No clauses defined. Click "Add Clause" or "Run Query" to fetch all project work items.
            </span>
          ) : (
            <div className="flex flex-col gap-2">
              {draftDef.filters.map((clause, idx) => {
                const availableOps = OPERATORS_BY_FIELD[clause.field || 'title'] || [];
                const valueLess = ['isEmpty', 'isNotEmpty'].includes(clause.operator || '');

                return (
                  <div key={idx} className="flex items-center gap-2 text-xs flex-wrap">
                    {/* Logical Operator */}
                    {idx === 0 ? (
                      <span className="w-16 font-mono text-[10px] text-[var(--text-muted)] font-semibold uppercase px-1">
                        WHERE
                      </span>
                    ) : (
                      <select
                        value={clause.logicalOperator || 'AND'}
                        onChange={(e) => {
                          const op = e.target.value as 'AND' | 'OR' | 'NOT';
                          setDraftDef((prev) => {
                            const updated = [...prev.filters];
                            updated[idx] = { ...updated[idx], logicalOperator: op };
                            return { ...prev, filters: updated };
                          });
                          setEditing(true);
                        }}
                        className="w-16 border border-[var(--border-default)] rounded px-1.5 py-1 bg-[var(--bg-surface)] font-mono text-[11px] font-semibold text-[var(--brand-primary)]"
                      >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                        <option value="NOT">NOT</option>
                      </select>
                    )}

                    {/* Field Selector */}
                    <select
                      value={clause.field || 'type'}
                      onChange={(e) => {
                        const f = e.target.value as QueryField;
                        const defaultOp = OPERATORS_BY_FIELD[f]?.[0]?.value || 'equals';
                        setDraftDef((prev) => {
                          const updated = [...prev.filters];
                          updated[idx] = { ...updated[idx], field: f, operator: defaultOp };
                          return { ...prev, filters: updated };
                        });
                        setEditing(true);
                      }}
                      className="border border-[var(--border-default)] rounded px-2.5 py-1 bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium"
                    >
                      {FIELD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {/* Operator Selector */}
                    <select
                      value={clause.operator || 'equals'}
                      onChange={(e) => {
                        const op = e.target.value as QueryOperator;
                        setDraftDef((prev) => {
                          const updated = [...prev.filters];
                          updated[idx] = { ...updated[idx], operator: op };
                          return { ...prev, filters: updated };
                        });
                        setEditing(true);
                      }}
                      className="border border-[var(--border-default)] rounded px-2.5 py-1 bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    >
                      {availableOps.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    {/* Value Input */}
                    {!valueLess && (
                      <div className="flex-1 flex items-center gap-1 min-w-[180px]">
                        {clause.field === 'type' ? (
                          <select
                            value={clause.value || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftDef((prev) => {
                                const updated = [...prev.filters];
                                updated[idx] = { ...updated[idx], value: val };
                                return { ...prev, filters: updated };
                              });
                              setEditing(true);
                            }}
                            className="flex-1 border border-[var(--border-default)] rounded px-2 py-1 bg-[var(--bg-surface)] text-[var(--text-primary)]"
                          >
                            <option value="">Any Type</option>
                            <option value="EPIC">EPIC</option>
                            <option value="FEATURE">FEATURE</option>
                            <option value="STORY">STORY</option>
                            <option value="TASK">TASK</option>
                            <option value="BUG">BUG</option>
                          </select>
                        ) : clause.field === 'priority' ? (
                          <select
                            value={clause.value || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftDef((prev) => {
                                const updated = [...prev.filters];
                                updated[idx] = { ...updated[idx], value: val };
                                return { ...prev, filters: updated };
                              });
                              setEditing(true);
                            }}
                            className="flex-1 border border-[var(--border-default)] rounded px-2 py-1 bg-[var(--bg-surface)] text-[var(--text-primary)]"
                          >
                            <option value="">Any Priority</option>
                            <option value="LOW">LOW</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="HIGH">HIGH</option>
                            <option value="URGENT">URGENT</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={clause.value || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftDef((prev) => {
                                const updated = [...prev.filters];
                                updated[idx] = { ...updated[idx], value: val };
                                return { ...prev, filters: updated };
                              });
                              setEditing(true);
                            }}
                            className="flex-1 border border-[var(--border-default)] rounded px-2.5 py-1 bg-[var(--bg-surface)] text-[var(--text-primary)]"
                            placeholder={
                              clause.field === 'assignedTo' || clause.field === 'createdBy'
                                ? 'User ID or @me...'
                                : clause.field === 'createdAt' || clause.field === 'updatedAt'
                                  ? 'YYYY-MM-DD...'
                                  : 'Enter value...'
                            }
                          />
                        )}

                        {(clause.field === 'assignedTo' || clause.field === 'createdBy') && (
                          <button
                            type="button"
                            onClick={() => {
                              setDraftDef((prev) => {
                                const updated = [...prev.filters];
                                updated[idx] = { ...updated[idx], value: '@me' };
                                return { ...prev, filters: updated };
                              });
                              setEditing(true);
                            }}
                            className="px-2 py-1 text-[11px] font-mono bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded hover:bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                            title="Set value to current user (@me)"
                          >
                            @me
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => removeFilter(idx)}
                      className="p-1 text-[var(--text-muted)] hover:text-rose-500 transition-colors"
                      title="Remove clause"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Error State Banner */}
        {runQuery.error && (
          <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-600 rounded-[var(--radius-card)]">
            <span className="font-semibold">Query Error:</span> {formatApiError(runQuery.error)}
          </div>
        )}

        {/* Results Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
            <span>
              Query Results {runQuery.data?.total != null ? `(${runQuery.data.total})` : `(${results.length})`}
            </span>
          </div>

          <QueryResultsTable
            items={results}
            isLoading={runQuery.isPending}
            onSelectItem={(item) => setSelectedWorkItem(item)}
          />
        </div>
      </div>

      {selectedWorkItem && (
        <WorkItemDrawer item={selectedWorkItem} onClose={() => setSelectedWorkItem(null)} />
      )}
    </div>
  );
}