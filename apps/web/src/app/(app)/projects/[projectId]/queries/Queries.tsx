'use client';

import React, { useState, useMemo } from 'react';
import { SearchCheck, Play, Save, X, Plus, Trash2, GripVertical, RotateCcw, Clock } from 'lucide-react';
import {
  useQueries,
  useRecentQueries,
  useRunQuery,
  useCreateQuery,
  useUpdateQuery,
  useDeleteQuery,
  SavedQuery,
  QueryDefinition,
  QueryClause,
  QueryField,
  QUERY_FIELDS,
  FIELD_OPERATORS,
  DEFAULT_DEFINITION,
} from '@/hooks/useQueries';
import { useIterations } from '@/hooks/useIterations';
import { useWorkItemStates } from '@/hooks/useWorkItemStates';
import { useAreas } from '@/hooks/useProjects';
import { WorkItem } from '@/hooks/useWorkItems';
import { WorkItemDrawer } from '@/components/WorkItemDrawer';
import { format } from 'date-fns';

const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'completedAt']);

const ENUM_FIELDS: Partial<Record<QueryField, Array<{ value: string; label: string }>>> = {
  type: [
    { value: 'EPIC', label: 'Epic' },
    { value: 'FEATURE', label: 'Feature' },
    { value: 'STORY', label: 'Story' },
    { value: 'TASK', label: 'Task' },
    { value: 'BUG', label: 'Bug' },
  ],
  priority: [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'URGENT', label: 'Urgent' },
  ],
};

export function Queries({ projectId }: { projectId: string }) {
  const { data: queries = [], isLoading: isLoadingQueries } = useQueries(projectId);
  const { data: recent = [] } = useRecentQueries(projectId);
  const runQuery = useRunQuery(projectId);
  const createQuery = useCreateQuery(projectId);
  const updateQuery = useUpdateQuery(projectId);
  const deleteQueryMut = useDeleteQuery(projectId);
  const { data: iterations = [] } = useIterations(projectId);
  const { data: states = [] } = useWorkItemStates(projectId);
  const { data: areas = [] } = useAreas(projectId);

  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftIsShared, setDraftIsShared] = useState(false);
  const [draftDef, setDraftDef] = useState<QueryDefinition>(DEFAULT_DEFINITION);

  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(null);

  const iterationMap = useMemo(
    () => Object.fromEntries(iterations.map((s) => [s.id, s])),
    [iterations],
  );
  const stateMap = useMemo(
    () => Object.fromEntries(states.map((s) => [s.key, s])),
    [states],
  );
  const areaMap = useMemo(
    () => Object.fromEntries(areas.map((a) => [a.id, a])),
    [areas],
  );

  const shared = queries.filter((q) => q.isShared);
  const mine = queries.filter((q) => !q.isShared);
  const results: WorkItem[] = useMemo(
    () => (Array.isArray(runQuery.data) ? runQuery.data : []),
    [runQuery.data],
  );

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
    setDraftDef({ ...DEFAULT_DEFINITION });
  };

  const enterEditMode = () => {
    const q = queries.find((x) => x.id === selectedQueryId);
    if (q) {
      setDraftName(q.name);
      setDraftDescription(q.description ?? '');
      setDraftIsShared(q.isShared);
      setDraftDef({ ...DEFAULT_DEFINITION, ...q.definition });
    }
    setEditing(true);
  };

  const handleRun = () => {
    runQuery.mutate({ id: selectedQueryId ?? undefined, definition: editing ? draftDef : undefined });
  };

  const handleSave = async () => {
    if (!draftName.trim()) return;
    try {
      if (selectedQueryId) {
        await updateQuery.mutateAsync({
          id: selectedQueryId,
          data: { name: draftName, description: draftDescription || null, isShared: draftIsShared, definition: draftDef },
        });
        setEditing(false);
        runQuery.mutate({ id: selectedQueryId });
      } else {
        const created = await createQuery.mutateAsync({
          name: draftName,
          description: draftDescription || null,
          isShared: draftIsShared,
          definition: draftDef,
        });
        setSelectedQueryId(created.id);
        setEditing(false);
        runQuery.mutate({ id: created.id });
      }
    } catch { /* mutation error state handled by tanstack */ }
  };

  const handleCancel = () => {
    if (selectedQueryId) {
      const q = queries.find((x) => x.id === selectedQueryId);
      if (q) {
        setDraftName(q.name);
        setDraftDescription(q.description ?? '');
        setDraftIsShared(q.isShared);
        setDraftDef({ ...DEFAULT_DEFINITION, ...q.definition });
      }
      setEditing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this query?')) return;
    const next = queries.find((q) => q.id !== id && q.isShared === false);
    await deleteQueryMut.mutateAsync(id);
    if (selectedQueryId === id) {
      setSelectedQueryId(next ? next.id : null);
      setEditing(false);
      if (next) runQuery.mutate({ id: next.id });
    }
  };

  const addClause = () => {
    setDraftDef((prev) => ({
      ...prev,
      filters: [
        ...prev.filters,
        { id: crypto.randomUUID(), logicalOperator: 'AND', field: 'title', operator: 'contains', value: '' },
      ],
    }));
  };

  const updateClause = (idx: number, patch: Partial<QueryClause>) => {
    setDraftDef((prev) => ({
      ...prev,
      filters: prev.filters.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  };

  const removeClause = (idx: number) => {
    setDraftDef((prev) => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== idx),
    }));
  };

  const toggleColumn = (col: QueryField) => {
    setDraftDef((prev) => {
      const cols = prev.columns.includes(col)
        ? prev.columns.filter((c) => c !== col)
        : [...prev.columns, col];
      return { ...prev, columns: cols };
    });
  };

  const formatValue = (value: unknown, col: QueryField): React.ReactNode => {
    if (col === 'key') return value as string;
    if (col === 'type') return <span className="inline-flex items-center px-2 py-0.5 rounded-[100px] text-[11px] font-medium bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)]">{value as string}</span>;
    if (col === 'title') return <span className="font-medium text-[var(--text-primary)]">{value as string}</span>;
    if (col === 'state') {
      const st = stateMap[value as string];
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: st?.color ?? '#94A3B8' }} />
          <span className="text-[13px]">{st?.name ?? (value as string)}</span>
        </span>
      );
    }
    if (col === 'priority') {
      const isHigh = value === 'HIGH' || value === 'URGENT';
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isHigh ? 'bg-[var(--priority-high)]' : 'bg-[var(--priority-medium)]'}`} />
          <span className="text-[13px]">{value as string}</span>
        </span>
      );
    }
    if (col === 'assignedTo') return (value as string | null) ?? <span className="text-[var(--text-muted)]">Unassigned</span>;
    if (col === 'iterationId') return value ? iterationMap[value as string]?.name ?? (value as string) : <span className="text-[var(--text-muted)]">-</span>;
    if (col === 'areaId') return value ? areaMap[value as string]?.name ?? (value as string) : <span className="text-[var(--text-muted)]">-</span>;
    if (col === 'parentId') return value ? (value as string).slice(0, 8) : <span className="text-[var(--text-muted)]">-</span>;
    if (col === 'createdBy') return value as string;
    if (col === 'tags') {
      const list = Array.isArray(value) ? (value as string[]) : [];
      return list.length > 0 ? (
        <span className="inline-flex flex-wrap gap-1">
          {list.map((t) => (
            <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded-[100px] text-[11px] bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
              {t}
            </span>
          ))}
        </span>
      ) : (
        <span className="text-[var(--text-muted)]">-</span>
      );
    }
    if (['createdAt', 'updatedAt', 'completedAt'].includes(col))
      return value ? format(new Date(value as string), 'MMM d, yyyy') : <span className="text-[var(--text-muted)]">-</span>;
    return String(value ?? '');
  };

  const renderValueInput = (clause: QueryClause, idx: number) => {
    if (['isEmpty', 'isNotEmpty'].includes(clause.operator)) return null;
    const isDate = DATE_FIELDS.has(clause.field);
    const enumOptions = ENUM_FIELDS[clause.field];
    const isIterationField = clause.field === 'iterationId';
    const isAreaField = clause.field === 'areaId';
    const isTagsField = clause.field === 'tags';
    const isUserField = ['assignedTo', 'createdBy'].includes(clause.field);
    const isListOperator = ['in', 'notIn'].includes(clause.operator);

    const inputClass =
      "flex-1 min-w-0 border border-[var(--border-default)] px-2 py-1 rounded-[var(--radius-input)] text-[12px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]";

    if (clause.operator === 'between' && isDate) {
      const [start = '', end = ''] = (clause.value ?? '').split(',');
      return (
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <input type="date" value={start} onChange={(e) => updateClause(idx, { value: `${e.target.value},${end}` })}
            className={inputClass} />
          <span className="text-[11px] text-[var(--text-muted)]">to</span>
          <input type="date" value={end} onChange={(e) => updateClause(idx, { value: `${start},${e.target.value}` })}
            className={inputClass} />
        </div>
      );
    }

    if (enumOptions && !isListOperator) {
      return (
        <select value={clause.value} onChange={(e) => updateClause(idx, { value: e.target.value })}
          className={inputClass}>
          <option value="">(any)</option>
          {enumOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }

    if (isIterationField && !isListOperator) {
      return (
        <select value={clause.value} onChange={(e) => updateClause(idx, { value: e.target.value })}
          className={inputClass}>
          <option value="">(any)</option>
          {iterations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      );
    }

    if (isAreaField && !isListOperator) {
      return (
        <select value={clause.value} onChange={(e) => updateClause(idx, { value: e.target.value })}
          className={inputClass}>
          <option value="">(any)</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      );
    }

    if (isDate) {
      return (
        <input type="date" value={clause.value} onChange={(e) => updateClause(idx, { value: e.target.value })}
          className={inputClass} />
      );
    }

    const placeholder = isTagsField
      ? isListOperator
        ? 'tag1,tag2'
        : 'tag name'
      : isUserField
        ? '@me'
        : 'value';

    return (
      <input type="text" value={clause.value} placeholder={placeholder} onChange={(e) => updateClause(idx, { value: e.target.value })}
        className={`${inputClass} placeholder:text-[var(--text-muted)]`} />
    );
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-4 border-b border-[var(--border-subtle)] shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">Queries</h1>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Build custom filters to track work across your project.</p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0 gap-3">
          <button
            onClick={startNewQuery}
            className="px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors"
          >
            + New Query
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden gap-0 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] min-h-0">
        {/* Sidebar */}
        <div className="w-64 border-r border-[var(--border-subtle)] flex flex-col shrink-0 bg-[var(--bg-surface-hover)]">
          {isLoadingQueries ? (
            <div className="p-4 text-[12px] text-[var(--text-muted)]">Loading queries...</div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {shared.length > 0 && (
                <div>
                  <div className="px-3 pt-3 pb-1.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Shared Queries</div>
                  {shared.map((q) => (
                    <button key={q.id} onClick={() => openSavedQuery(q)}
                      className={`w-full text-left px-3 py-2 text-[13px] transition-colors group flex items-center justify-between ${selectedQueryId === q.id && !editing ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] font-medium' : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'}`}>
                      <span className="truncate">{q.name}</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}>
                        <Trash2 className="w-3.5 h-3.5 text-[var(--text-muted)] hover:text-[var(--priority-high)]" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div>
                <div className="px-3 pt-3 pb-1.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">My Queries</div>
                {mine.length === 0 && shared.length === 0 && (
                  <div className="px-4 py-6 text-center text-[12px] text-[var(--text-muted)]">No queries yet. Click New Query to start.</div>
                )}
                {mine.map((q) => (
                  <button key={q.id} onClick={() => openSavedQuery(q)}
                    className={`w-full text-left px-3 py-2 text-[13px] transition-colors group flex items-center justify-between ${selectedQueryId === q.id && !editing ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] font-medium' : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'}`}>
                    <span className="truncate">{q.name}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}>
                      <Trash2 className="w-3.5 h-3.5 text-[var(--text-muted)] hover:text-[var(--priority-high)]" />
                    </span>
                  </button>
                ))}
              </div>
              {recent.length > 0 && (
                <div className="pt-2 mt-2 border-t border-[var(--border-subtle)]">
                  <div className="px-3 pt-3 pb-1.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    Recent
                  </div>
                  {recent.map((q) => (
                    <button key={q.id} onClick={() => openSavedQuery(q)}
                      className={`w-full text-left px-3 py-2 text-[13px] transition-colors flex items-center justify-between ${selectedQueryId === q.id && !editing ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] font-medium' : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'}`}>
                      <span className="truncate">{q.name}</span>
                      {q.lastRunAt && (
                        <span className="ml-2 text-[11px] text-[var(--text-muted)] shrink-0">{format(new Date(q.lastRunAt), 'MMM d')}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {!selectedQueryId && !editing ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <SearchCheck className="w-12 h-12 text-[var(--text-muted)] mb-4" strokeWidth={1.5} />
              <p className="text-[15px] font-medium text-[var(--text-secondary)]">No query selected</p>
              <p className="text-[13px] text-[var(--text-muted)] mt-1">Select or create a query to view results.</p>
            </div>
          ) : (
            <>
              {/* Query header bar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] shrink-0 gap-3">
                {editing ? (
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <input autoFocus value={draftName} onChange={(e) => setDraftName(e.target.value)}
                        className="text-[14px] font-semibold text-[var(--text-primary)] bg-transparent border-b border-[var(--border-focus)] focus:outline-none px-0 pb-0.5 flex-1 min-w-0" />
                      <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] select-none cursor-pointer shrink-0">
                        <input type="checkbox" checked={draftIsShared} onChange={(e) => setDraftIsShared(e.target.checked)}
                          className="w-3.5 h-3.5 accent-[var(--brand-primary)] cursor-pointer" />
                        Shared
                      </label>
                    </div>
                    <input value={draftDescription} placeholder="Query description (optional)" onChange={(e) => setDraftDescription(e.target.value)}
                      className="text-[12px] text-[var(--text-secondary)] bg-transparent focus:outline-none placeholder:text-[var(--text-muted)]" />
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{queries.find((q) => q.id === selectedQueryId)?.name ?? 'Query'}</h2>
                    {queries.find((q) => q.id === selectedQueryId)?.description && (
                      <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 truncate">{queries.find((q) => q.id === selectedQueryId)?.description}</p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={handleRun} disabled={runQuery.isPending}
                    className="px-3 py-1.5 text-[12px] font-medium bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors flex items-center gap-1.5">
                    <Play className="w-3 h-3" />
                    {runQuery.isPending ? 'Running...' : 'Run'}
                  </button>
                  {!editing ? (
                    <>
                      <button onClick={enterEditMode}
                        className="px-3 py-1.5 text-[12px] font-medium bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] hover:bg-[var(--bg-surface-hover)] transition-colors">
                        Edit Query
                      </button>
                      {selectedQueryId && (
                        <button onClick={() => handleDelete(selectedQueryId)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--priority-high)] rounded-[var(--radius-button)] transition-colors" title="Delete query">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button onClick={handleSave}
                        className="px-3 py-1.5 text-[12px] font-medium bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center gap-1.5">
                        <Save className="w-3 h-3" />
                        {createQuery.isPending || updateQuery.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={handleCancel}
                        className="px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-button)] transition-colors">
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Editor (when editing) */}
              {editing && (
                <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-selected)] flex flex-col gap-3 shrink-0">
                  {/* Filters section */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      <GripVertical className="w-3 h-3 text-[var(--text-muted)]" />
                      Filter Clauses
                    </div>
                    {draftDef.filters.length === 0 && (
                      <p className="text-[12px] text-[var(--text-muted)] italic">No filters — all work items returned.</p>
                    )}
                    {draftDef.filters.map((clause, idx) => {
                      const operators = FIELD_OPERATORS[clause.field] ?? ['equals'];
                      const validOps = operators.includes(clause.operator) ? operators : [...operators, clause.operator];
                      return (
                        <div key={clause.id ?? idx} className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-input)] p-1.5">
                          {idx === 0 ? (
                            <div className="w-[52px] shrink-0 text-center text-[11px] text-[var(--text-muted)] font-medium py-1">IF</div>
                          ) : (
                            <select value={clause.logicalOperator} onChange={(e) => updateClause(idx, { logicalOperator: e.target.value as 'AND' | 'OR' })}
                              className="w-[52px] shrink-0 border border-[var(--border-default)] text-[11px] px-1 py-1 rounded-[var(--radius-input)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium focus:outline-none focus:border-[var(--border-focus)]">
                              <option value="AND">AND</option>
                              <option value="OR">OR</option>
                            </select>
                          )}
                          <select value={clause.field} onChange={(e) => updateClause(idx, { field: e.target.value as QueryField, value: '', operator: (FIELD_OPERATORS[e.target.value as QueryField]?.[0] ?? 'equals') })}
                            className="w-[120px] shrink-0 border border-[var(--border-default)] px-2 py-1 rounded-[var(--radius-input)] text-[12px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]">
                            {QUERY_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                          <select value={clause.operator} onChange={(e) => updateClause(idx, { operator: e.target.value as QueryClause['operator'] })}
                            className="w-[100px] shrink-0 border border-[var(--border-default)] px-2 py-1 rounded-[var(--radius-input)] text-[12px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]">
                            {validOps.map((op) => (
                              <option key={op} value={op}>
                                {op.replace(/([A-Z])/g, ' $1').replace(/^(.)/, (_, c) => c.toUpperCase())}
                              </option>
                            ))}
                          </select>
                          {renderValueInput(clause, idx)}
                          <button onClick={() => removeClause(idx)}
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--priority-high)] rounded transition-colors shrink-0" title="Remove clause">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    <button onClick={addClause}
                      className="flex items-center gap-1.5 text-[12px] text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] font-medium mt-1 w-fit transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add clause
                    </button>
                  </div>

                  {/* Columns & Sort */}
                  <div className="flex flex-wrap gap-6 pt-2 border-t border-[var(--border-subtle)]">
                    <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Columns</span>
                      <div className="flex flex-wrap gap-1.5">
                        {QUERY_FIELDS.map((f) => {
                          const selected = draftDef.columns.includes(f.value);
                          return (
                            <button key={f.value} onClick={() => toggleColumn(f.value)}
                              className={`px-2 py-1 rounded-[100px] text-[11px] font-medium border transition-colors ${selected ? 'bg-[var(--brand-primary)]/10 border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-default)]'}`}>
                              {f.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Sort by</span>
                        <select value={draftDef.sortBy} onChange={(e) => setDraftDef((p) => ({ ...p, sortBy: e.target.value as QueryField }))}
                          className="px-2 py-1 border border-[var(--border-default)] rounded-[var(--radius-input)] text-[12px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]">
                          {QUERY_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Order</span>
                        <button onClick={() => setDraftDef((p) => ({ ...p, sortOrder: p.sortOrder === 'asc' ? 'desc' : 'asc' }))}
                          className="px-3 py-1 border border-[var(--border-default)] rounded-[var(--radius-input)] text-[12px] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] flex items-center gap-1 transition-colors">
                          <RotateCcw className="w-3 h-3" />
                          {draftDef.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Results */}
              <div className="flex-1 overflow-auto min-h-0">
                {runQuery.isPending ? (
                  <div className="p-6 text-[13px] text-[var(--text-muted)]">Running query...</div>
                ) : runQuery.isError ? (
                  <div className="p-6 text-[13px] text-[var(--priority-high)]">Failed to run query.</div>
                ) : results.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-[var(--text-muted)]">No results match this query.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="px-4 py-2 text-[12px] text-[var(--text-muted)] border-b border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]">
                      {results.length} {results.length === 1 ? 'result' : 'results'}
                    </div>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] sticky top-0 z-10">
                          {(editing ? draftDef.columns : queries.find((q) => q.id === selectedQueryId)?.definition.columns ?? draftDef.columns).map((col) => (
                            <th key={col} className="px-4 py-2 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">
                              {QUERY_FIELDS.find((f) => f.value === col)?.label ?? col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((item) => {
                          const activeCols = editing ? draftDef.columns : queries.find((q) => q.id === selectedQueryId)?.definition.columns ?? draftDef.columns;
                          return (
                            <tr key={item.id} onClick={() => setSelectedWorkItem(item)}
                              className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer">
                              {activeCols.map((col) => (
                                <td key={col} className="px-4 py-2 text-[13px] text-[var(--text-secondary)] whitespace-nowrap max-w-[220px] truncate">
                                  {formatValue((item as unknown as Record<string, unknown>)[col], col)}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {selectedWorkItem && (
        <WorkItemDrawer item={selectedWorkItem} onClose={() => setSelectedWorkItem(null)} />
      )}
    </div>
  );
}