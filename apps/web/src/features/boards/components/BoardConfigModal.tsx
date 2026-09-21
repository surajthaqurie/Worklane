'use client';

import React, { useState } from 'react';
import { BoardConfig, BoardColumn, CardFields, FilterConfig, BacklogLevel, SwimlaneType } from '@/shared/types/boards';
import { WorkItemState } from '@/shared/types/work-items';
import { useUpdateBoard, useCreateBoard } from '../hooks/useBoards';
import { useTeams } from '@/features/teams/hooks/useTeams';
import { StatesTabContent } from './StatesManager';
import { Modal } from '@/shared/components/ui/Modal';
import { Plus, ChevronUp, ChevronDown, Trash2, AlertTriangle, Settings2, Sliders, Layout, Filter, Tag, Columns3 } from 'lucide-react';
import { formatApiError } from '@/shared/utils/error';
import { SWIMLANE_OPTIONS } from '../swimlanes';

export interface BoardConfigModalProps {
  projectId: string;
  board?: BoardConfig | null;
  states: WorkItemState[];
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (boardId: string) => void;
}

export function BoardConfigModal({
  projectId,
  board,
  states,
  isOpen,
  onClose,
  onSaved,
}: BoardConfigModalProps) {
  const isEditing = !!board;
  const updateBoard = useUpdateBoard(projectId);
  const createBoard = useCreateBoard(projectId);
  const { data: teams = [] } = useTeams(projectId);

  const [activeTab, setActiveTab] = useState<'columns' | 'states' | 'cardFields' | 'filters' | 'general'>('columns');
  const [name, setName] = useState(board?.name || 'Custom Board');
  const [description, setDescription] = useState(board?.description || '');
  const [teamId, setTeamId] = useState<string | null>(board?.teamId ?? null);
  const [swimlane, setSwimlane] = useState<SwimlaneType>(board?.swimlane ?? 'none');

  const [columns, setColumns] = useState<BoardColumn[]>(() => {
    if (board?.columns && board.columns.length > 0) {
      return board.columns;
    }
    return states.map((s, idx) => ({
      id: `col-${s.key.toLowerCase()}`,
      name: s.name,
      mappedStates: [s.key],
      wipLimit: idx === 1 ? 5 : null,
    }));
  });

  const [cardFields, setCardFields] = useState<CardFields>(() => {
    return (
      board?.cardFields || {
        showType: true,
        showPriority: true,
        showAssignee: true,
        showPoints: true,
        showParent: true,
        showTags: true,
      }
    );
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [filterConfig, setFilterConfig] = useState<FilterConfig>(() => {
    return board?.filterConfig || {};
  });

  const handleFilterChange = <K extends keyof FilterConfig>(
    field: K,
    value: FilterConfig[K] | null
  ) => {
    setErrorMsg(null);
    setFilterConfig((prev) => ({ ...prev, [field]: value ?? undefined }));
  };

  const handleAddColumn = () => {
    const unmappedState = states.find(
      (s) => !columns.some((c) => c.mappedStates.includes(s.key))
    );
    const newCol: BoardColumn = {
      id: `col-${Date.now()}`,
      name: unmappedState ? unmappedState.name : 'New Column',
      mappedStates: unmappedState ? [unmappedState.key] : [],
      wipLimit: null,
    };
    setColumns((prev) => [...prev, newCol]);
  };

  const handleMoveColumn = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    [next[index], next[target]] = [next[target], next[index]];
    setColumns(next);
  };

  const handleRemoveColumn = (index: number) => {
    if (columns.length <= 1) {
      setErrorMsg('A board must keep at least one column.');
      return;
    }
    setColumns((prev) => prev.filter((_, i) => i !== index));
  };

  const handleColumnChange = <K extends keyof BoardColumn>(
    index: number,
    field: K,
    value: BoardColumn[K]
  ) => {
    setErrorMsg(null);
    setColumns((prev) =>
      prev.map((col, i) => (i === index ? { ...col, [field]: value } : col))
    );
  };

  const handleToggleMappedState = (colIndex: number, stateKey: string) => {
    setErrorMsg(null);
    setColumns((prev) => {
      const isTargetCurrentlyMapped = prev[colIndex].mappedStates.includes(stateKey);
      return prev.map((col, i) => {
        if (i === colIndex) {
          const nextStates = isTargetCurrentlyMapped
            ? col.mappedStates.filter((k) => k !== stateKey)
            : [...col.mappedStates, stateKey];
          return { ...col, mappedStates: nextStates };
        } else {
          // If stateKey is being added to colIndex, remove it from other columns to guarantee 1-to-1 mapping
          if (!isTargetCurrentlyMapped && col.mappedStates.includes(stateKey)) {
            return { ...col, mappedStates: col.mappedStates.filter((k) => k !== stateKey) };
          }
          return col;
        }
      });
    });
  };

  const handleSave = async () => {
    setErrorMsg(null);
    if (!name.trim()) {
      setErrorMsg('Board name is required.');
      return;
    }

    const emptyCol = columns.find((c) => !c.mappedStates || c.mappedStates.length === 0);
    if (emptyCol) {
      setErrorMsg(`Column "${emptyCol.name}" must map to at least one workflow state.`);
      return;
    }

    const unmappedStates = states.filter(
      (s) => !columns.some((c) => c.mappedStates.includes(s.key))
    );
    if (unmappedStates.length > 0) {
      setErrorMsg(
        `Every state must be mapped to a column. Unmapped: ${unmappedStates
          .map((s) => s.name)
          .join(', ')}`
      );
      return;
    }

    const stateMap = new Map<string, string[]>();
    for (const col of columns) {
      for (const sKey of col.mappedStates) {
        const existing = stateMap.get(sKey) || [];
        stateMap.set(sKey, [...existing, col.name]);
      }
    }
    const duplicated = [...stateMap.entries()].filter(([, cols]) => cols.length > 1);
    if (duplicated.length > 0) {
      const stateObj = states.find((s) => s.key === duplicated[0][0]);
      const stateName = stateObj ? stateObj.name : duplicated[0][0];
      setErrorMsg(
        `Workflow state "${stateName}" is mapped to more than one column (${duplicated[0][1].join(', ')}). Each state must map to exactly one column.`
      );
      return;
    }

    try {
      if (isEditing && board) {
        const res = await updateBoard.mutateAsync({
          boardId: board.id,
          data: {
            name: name.trim(),
            description: description.trim() || null,
            teamId,
            swimlane,
            columns,
            cardFields,
            filterConfig,
          },
        });
        if (onSaved) onSaved(res.id);
      } else {
        const res = await createBoard.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          teamId,
          swimlane,
          columns,
          cardFields,
          filterConfig,
        });
        if (onSaved) onSaved(res.id);
      }
      onClose();
    } catch (e) {
      setErrorMsg(formatApiError(e));
    }
  };

  const isSaving = updateBoard.isPending || createBoard.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Configure ${board.name}` : 'Create New Board'}
      maxWidthClass="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--border-subtle)] text-xs font-medium">
          <button
            onClick={() => setActiveTab('columns')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors ${
              activeTab === 'columns'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            Columns & WIP
          </button>
          <button
            onClick={() => setActiveTab('states')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors ${
              activeTab === 'states'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Workflow States
          </button>
          <button
            onClick={() => setActiveTab('cardFields')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors ${
              activeTab === 'cardFields'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Card Customization
          </button>
          <button
            onClick={() => setActiveTab('filters')}
            className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'filters'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-[var(--radius-card)] text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab 1: Columns */}
        {activeTab === 'columns' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">
                Organize columns, set WIP limits, and map work item states.
              </span>
              <button
                type="button"
                onClick={handleAddColumn}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)] rounded-[var(--radius-button)] text-[var(--text-primary)] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Column
              </button>
            </div>

            <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
              {columns.map((col, idx) => (
                <div
                  key={col.id}
                  className="p-3 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={col.name}
                      onChange={(e) => handleColumnChange(idx, 'name', e.target.value)}
                      placeholder="Column Name"
                      className="flex-1 text-xs font-semibold px-2 py-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-input)] text-[var(--text-primary)] focus:outline-none"
                    />

                    <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                      <span>WIP:</span>
                      <input
                        type="number"
                        min={0}
                        value={col.wipLimit ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value, 10) : null;
                          handleColumnChange(idx, 'wipLimit', val);
                        }}
                        placeholder="∞"
                        className="w-14 text-xs px-1.5 py-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-input)] text-[var(--text-primary)] focus:outline-none text-center"
                      />
                    </div>

                    <div className="flex items-center gap-0.5 ml-2">
                      <button
                        type="button"
                        onClick={() => handleMoveColumn(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveColumn(idx, 1)}
                        disabled={idx === columns.length - 1}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(idx)}
                        className="p-1 text-rose-500 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
                    <span className="text-[10px] text-[var(--text-muted)] self-center mr-1">
                      Mapped States:
                    </span>
                    {states.map((s) => {
                      const isMapped = col.mappedStates.includes(s.key);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleToggleMappedState(idx, s.key)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                            isMapped
                              ? 'bg-[var(--brand-primary)] text-white border-transparent'
                              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                          }`}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Workflow States */}
        {activeTab === 'states' && (
          <StatesTabContent projectId={projectId} />
        )}

        {/* Tab 3: Card Customization */}
        {activeTab === 'cardFields' && (
          <div className="flex flex-col gap-3">
            <span className="text-xs text-[var(--text-secondary)]">
              Choose which fields are displayed on board cards.
            </span>
            <div className="grid grid-cols-2 gap-3 p-4 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] text-xs">
              {Object.entries({
                showType: 'Work Item Type Badge',
                showPriority: 'Priority Indicator',
                showAssignee: 'Assignee Avatar',
                showPoints: 'Story Points',
                showParent: 'Parent Work Item Key',
                showTags: 'Tags',
              }).map(([key, label]) => {
                const fieldKey = key as keyof CardFields;
                return (
                  <label key={key} className="flex items-center gap-2 cursor-pointer text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={cardFields[fieldKey] !== false}
                      onChange={(e) =>
                        setCardFields((prev) => ({ ...prev, [fieldKey]: e.target.checked }))
                      }
                      className="rounded border-[var(--border-default)] text-[var(--brand-primary)] focus:ring-0"
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Filters */}
        {activeTab === 'filters' && (
          <div className="flex flex-col gap-4">
            <span className="text-xs text-[var(--text-secondary)]">
              Default filters applied when this board is opened. Users can still refine them live.
            </span>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Backlog Level</label>
              <select
                value={filterConfig.backlogLevel ?? ''}
                onChange={(e) =>
                  handleFilterChange('backlogLevel', (e.target.value || null) as BacklogLevel | null)
                }
                className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
              >
                <option value="">All Levels</option>
                <option value="EPIC">Epics</option>
                <option value="FEATURE">Features</option>
                <option value="STORY">Stories & Bugs</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Work Item Types</label>
              <div className="flex flex-wrap gap-1.5">
                {(['EPIC', 'FEATURE', 'STORY', 'TASK', 'BUG'] as const).map((type) => {
                  const enabled = filterConfig.types?.includes(type) ?? true;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const current = filterConfig.types ?? ['EPIC', 'FEATURE', 'STORY', 'TASK', 'BUG'];
                        const next = enabled
                          ? current.filter((t) => t !== type)
                          : [...current, type];
                        setFilterConfig((prev) => ({
                          ...prev,
                          types: next.length === 0 || next.length === 5 ? undefined : next,
                        }));
                      }}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                        enabled
                          ? 'bg-[var(--brand-primary)] text-white border-transparent'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">
                Disabled types are hidden from this board.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Assignee</label>
              <select
                value={filterConfig.assignedTo ?? ''}
                onChange={(e) =>
                  handleFilterChange('assignedTo', e.target.value || null)
                }
                className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
              >
                <option value="">Any Assignee</option>
                <option value="UNASSIGNED">Unassigned</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Tag Filter</label>
              <input
                type="text"
                value={filterConfig.tags ?? ''}
                onChange={(e) => handleFilterChange('tags', e.target.value || null)}
                placeholder="Comma separated tags"
                className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Tab 4: General Settings */}
        {activeTab === 'general' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Board Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
                placeholder="Board description..."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Team Owner</label>
              <select
                value={teamId || ''}
                onChange={(e) => setTeamId(e.target.value || null)}
                className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
              >
                <option value="">Project-wide (No specific team)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                <Columns3 className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                Swimlane Grouping
              </label>
              <select
                value={swimlane}
                onChange={(e) => setSwimlane(e.target.value as SwimlaneType)}
                className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
              >
                {SWIMLANE_OPTIONS.map((mode) => (
                  <option key={mode.type} value={mode.type}>
                    {mode.label}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-[var(--text-muted)]">
                {SWIMLANE_OPTIONS.find((m) => m.type === swimlane)?.description}
              </span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-medium bg-[var(--brand-primary)] text-white hover:opacity-90 rounded-[var(--radius-button)] transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
