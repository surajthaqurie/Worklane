'use client';

import React, { useState, useMemo } from 'react';
import { SearchCheck, Play, Save, Plus, Trash2 } from 'lucide-react';
import {
  useQueries,
  useRecentQueries,
  useRunQuery,
  useCreateQuery,
  useUpdateQuery,
  useDeleteQuery,
  DEFAULT_DEFINITION,
} from '@/features/queries/hooks/useQueries';
import { SavedQuery, QueryDefinition, QueryClause, QueryField, QueryOperator } from '@/features/queries/api/queriesApi';
import { WorkItem } from '@/shared/types/work-items';
import { WorkItemDrawer } from '@/features/work-items/components/WorkItemDrawer';
import { QueryResultsTable } from '@/features/queries/components/QueryResultsTable';

export function Queries({ projectId }: { projectId: string }) {
  const { data: queries = [] } = useQueries(projectId);
  const { data: recent = [] } = useRecentQueries(projectId);
  const runQuery = useRunQuery(projectId);
  const createQuery = useCreateQuery(projectId);
  const updateQuery = useUpdateQuery(projectId);
  const deleteQueryMut = useDeleteQuery(projectId);

  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftIsShared, setDraftIsShared] = useState(false);
  const [draftDef, setDraftDef] = useState<QueryDefinition>(DEFAULT_DEFINITION);
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(null);

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
      field: 'type',
      operator: 'equals',
      value: 'STORY',
    };
    setDraftDef((prev) => ({
      ...prev,
      filters: [...prev.filters, newClause],
    }));
  };

  const removeFilter = (index: number) => {
    setDraftDef((prev) => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index),
    }));
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

  return (
    <div className="flex h-full min-h-[600px] gap-6 p-6">
      {/* Sidebar: Saved & Recent Queries */}
      <div className="w-64 shrink-0 flex flex-col gap-6 border-r border-[var(--border-subtle)] pr-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Queries</h2>
          <button
            onClick={startNewQuery}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] hover:opacity-90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto">
          {/* Saved Queries */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Saved Queries
            </span>
            {queries.length === 0 ? (
              <span className="text-xs text-[var(--text-muted)] italic py-1">No saved queries</span>
            ) : (
              queries.map((q) => (
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
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Recent Queries
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
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-3">
            <SearchCheck className="w-5 h-5 text-[var(--brand-primary)]" />
            <input
              type="text"
              value={draftName}
              onChange={(e) => {
                setDraftName(e.target.value);
                setEditing(true);
              }}
              placeholder="Query Name"
              className="text-base font-semibold bg-transparent border-b border-transparent focus:border-[var(--border-focus)] outline-none text-[var(--text-primary)]"
            />
          </div>

          <div className="flex items-center gap-2">
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
            )}
          </div>
        </div>

        {/* Query Clauses Builder */}
        <div className="flex flex-col gap-3 p-4 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-primary)]">Filter Clauses</span>
            <button
              onClick={addFilter}
              className="flex items-center gap-1 text-xs text-[var(--brand-primary)] font-medium hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Add Clause
            </button>
          </div>

          {draftDef.filters.length === 0 ? (
            <span className="text-xs text-[var(--text-muted)] italic py-2">
              No clauses defined. Running will return all work items.
            </span>
          ) : (
            <div className="flex flex-col gap-2">
              {draftDef.filters.map((clause, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  {idx > 0 && (
                    <span className="font-mono text-[10px] text-[var(--text-muted)] px-1">
                      {clause.logicalOperator}
                    </span>
                  )}
                  <select
                    value={clause.field}
                    onChange={(e) => {
                      const f = e.target.value as QueryField;
                      setDraftDef((prev) => {
                        const updated = [...prev.filters];
                        updated[idx] = { ...updated[idx], field: f };
                        return { ...prev, filters: updated };
                      });
                      setEditing(true);
                    }}
                    className="border border-[var(--border-default)] rounded px-2 py-1 bg-[var(--bg-surface)] text-[var(--text-primary)]"
                  >
                    <option value="type">Type</option>
                    <option value="state">State</option>
                    <option value="priority">Priority</option>
                    <option value="title">Title</option>
                    <option value="assignedTo">Assignee</option>
                  </select>

                  <select
                    value={clause.operator}
                    onChange={(e) => {
                      const op = e.target.value as QueryOperator;
                      setDraftDef((prev) => {
                        const updated = [...prev.filters];
                        updated[idx] = { ...updated[idx], operator: op };
                        return { ...prev, filters: updated };
                      });
                      setEditing(true);
                    }}
                    className="border border-[var(--border-default)] rounded px-2 py-1 bg-[var(--bg-surface)] text-[var(--text-primary)]"
                  >
                    <option value="equals">equals</option>
                    <option value="notEquals">does not equal</option>
                    <option value="contains">contains</option>
                  </select>

                  <input
                    type="text"
                    value={clause.value}
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
                    placeholder="Value..."
                  />

                  <button
                    onClick={() => removeFilter(idx)}
                    className="p-1 text-[var(--text-muted)] hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
            <span>Query Results ({results.length})</span>
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