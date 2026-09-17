'use client';

import React, { useState } from 'react';
import {
  BoardConfig,
  BoardColumn,
  CardFields,
  useUpdateBoard,
  useCreateBoard,
} from '@/hooks/useBoards';
import { WorkItemState } from '@/hooks/useWorkItemStates';
import { useTeams } from '@/hooks/useTeams';
import { X, Plus, ChevronUp, ChevronDown, Trash2, AlertTriangle, Settings2, Sliders, Layout, Info } from 'lucide-react';

type BoardConfigModalProps = {
  projectId: string;
  board?: BoardConfig | null;
  states: WorkItemState[];
  onClose: () => void;
  onSaved?: (boardId: string) => void;
};

export function BoardConfigModal({
  projectId,
  board,
  states,
  onClose,
  onSaved,
}: BoardConfigModalProps) {
  const isEditing = !!board;
  const updateBoard = useUpdateBoard(projectId);
  const createBoard = useCreateBoard(projectId);
  const { data: teams = [] } = useTeams(projectId);

  const [activeTab, setActiveTab] = useState<'columns' | 'cardFields' | 'general'>('columns');

  // Form State
  const [name, setName] = useState(board?.name || 'Custom Board');
  const [description, setDescription] = useState(board?.description || '');
  const [teamId, setTeamId] = useState<string | null>(board?.teamId ?? null);

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

  const handleAddColumn = () => {
    const unmappedState = states.find(
      (s) => !columns.some((c) => c.mappedStates.includes(s.key)),
    );
    const newCol: BoardColumn = {
      id: `col-${Date.now()}`,
      name: unmappedState ? unmappedState.name : 'New Column',
      mappedStates: unmappedState ? [unmappedState.key] : states[0] ? [states[0].key] : [],
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

  const handleColumnChange = (index: number, field: keyof BoardColumn, value: any) => {
    setErrorMsg(null);
    setColumns((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );
  };

  const handleToggleStateMapping = (colIndex: number, stateKey: string) => {
    setErrorMsg(null);
    setColumns((prev) =>
      prev.map((c, i) => {
        if (i !== colIndex) return c;
        const exists = c.mappedStates.includes(stateKey);
        const nextMapped = exists
          ? c.mappedStates.filter((k) => k !== stateKey)
          : [...c.mappedStates, stateKey];
        return { ...c, mappedStates: nextMapped };
      }),
    );
  };

  const handleSave = async () => {
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Board name is required.');
      return;
    }

    if (columns.length === 0) {
      setErrorMsg('A board must have at least one column.');
      return;
    }

    for (const c of columns) {
      if (!c.name.trim()) {
        setErrorMsg('All columns must have a display name.');
        return;
      }
      if (c.mappedStates.length === 0) {
        setErrorMsg(`Column "${c.name}" must map to at least one workflow state.`);
        return;
      }
    }

    try {
      if (isEditing && board) {
        await updateBoard.mutateAsync({
          boardId: board.id,
          data: {
            name: name.trim(),
            description: description.trim() || null,
            teamId: teamId || null,
            columns,
            cardFields,
          },
        });
        if (onSaved) onSaved(board.id);
      } else {
        const created = await createBoard.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          teamId: teamId || null,
          columns,
          cardFields,
        });
        if (onSaved) onSaved(created.id);
      }
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to save board configuration.');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="fixed inset-0 m-auto w-full max-w-2xl h-fit max-h-[90vh] bg-[var(--bg-surface)] shadow-2xl z-50 rounded-[var(--radius-card)] flex flex-col border border-[var(--border-subtle)] overflow-hidden">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[var(--radius-button)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
                {isEditing ? `Configure ${board.name}` : 'New Configurable Board'}
              </h2>
              <p className="text-[12px] text-[var(--text-secondary)]">
                Customize board columns, mapped states, WIP limits, card fields, and scope.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 bg-[var(--bg-surface-hover)] rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-[var(--brand-primary)]/5 border-b border-[var(--brand-primary)]/10 px-6 py-2.5 flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
          <Info className="w-4 h-4 text-[var(--brand-primary)] shrink-0" />
          <span>
            Board presentation is separate from workflow definition. Changing columns or mapped states will{' '}
            <strong className="text-[var(--text-primary)]">never corrupt work-item states</strong> in the database.
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[var(--border-subtle)] px-6 bg-[var(--bg-app)]">
          <button
            onClick={() => setActiveTab('columns')}
            className={`py-3 mr-6 text-[13px] font-medium relative flex items-center gap-1.5 ${
              activeTab === 'columns'
                ? 'text-[var(--brand-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Layout className="w-3.5 h-3.5" /> Columns & WIP Limits
            {activeTab === 'columns' && (
              <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--brand-primary)]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('cardFields')}
            className={`py-3 mr-6 text-[13px] font-medium relative flex items-center gap-1.5 ${
              activeTab === 'cardFields'
                ? 'text-[var(--brand-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Card Fields
            {activeTab === 'cardFields' && (
              <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--brand-primary)]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 text-[13px] font-medium relative flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'text-[var(--brand-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" /> General & Scope
            {activeTab === 'general' && (
              <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--brand-primary)]" />
            )}
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-[var(--priority-high)]/10 border border-[var(--priority-high)]/30 rounded-[var(--radius-card)] text-[12px] text-[var(--priority-high)] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 max-h-[55vh]">
          {activeTab === 'columns' && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[12px] text-[var(--text-secondary)]">
                  Configure display columns and map work-item workflow states to each column.
                </span>
                <button
                  onClick={handleAddColumn}
                  className="px-2.5 py-1 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20 text-[12px] font-medium rounded-[var(--radius-button)] transition-colors flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Column
                </button>
              </div>

              {columns.map((col, idx) => (
                <div
                  key={col.id}
                  className="p-4 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] flex flex-col gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleMoveColumn(idx, -1)}
                        disabled={idx === 0}
                        className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveColumn(idx, 1)}
                        disabled={idx === columns.length - 1}
                        className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 flex flex-wrap gap-2 items-center">
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => handleColumnChange(idx, 'name', e.target.value)}
                        placeholder="Column Name"
                        className="flex-1 min-w-[150px] border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] font-medium"
                      />

                      <div className="flex items-center gap-1.5 shrink-0">
                        <label className="text-[11px] font-medium text-[var(--text-muted)]">WIP Limit:</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="No limit"
                          value={col.wipLimit === null || col.wipLimit === undefined ? '' : col.wipLimit}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleColumnChange(
                              idx,
                              'wipLimit',
                              val === '' ? null : Math.max(0, parseInt(val, 10)),
                            );
                          }}
                          className="w-20 border border-[var(--border-default)] rounded-[var(--radius-input)] px-2 py-1 text-[12px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveColumn(idx)}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--priority-high)] transition-colors shrink-0"
                      title="Remove column"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mapped States Pickers */}
                  <div className="flex flex-col gap-1.5 pl-6 border-l-2 border-[var(--border-subtle)]">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Mapped Workflow States
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {states.map((st) => {
                        const isMapped = col.mappedStates.includes(st.key);
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => handleToggleStateMapping(idx, st.key)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors flex items-center gap-1.5 ${
                              isMapped
                                ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/40 font-semibold'
                                : 'bg-[var(--bg-surface-hover)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: st.color }}
                            />
                            {st.name} ({st.key})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'cardFields' && (
            <div className="flex flex-col gap-4">
              <span className="text-[12px] text-[var(--text-secondary)] mb-2">
                Choose which fields are displayed on work item cards on this board.
              </span>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-3 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] cursor-pointer hover:border-[var(--border-default)] transition-colors">
                  <input
                    type="checkbox"
                    checked={!!cardFields.showType}
                    onChange={(e) =>
                      setCardFields((prev) => ({ ...prev, showType: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[var(--brand-primary)] cursor-pointer"
                  />
                  <div>
                    <div className="text-[13px] font-medium text-[var(--text-primary)]">Work Item Type</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Badge showing Task, Story, Bug, Feature</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] cursor-pointer hover:border-[var(--border-default)] transition-colors">
                  <input
                    type="checkbox"
                    checked={!!cardFields.showPriority}
                    onChange={(e) =>
                      setCardFields((prev) => ({ ...prev, showPriority: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[var(--brand-primary)] cursor-pointer"
                  />
                  <div>
                    <div className="text-[13px] font-medium text-[var(--text-primary)]">Priority</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Priority level & color dot</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] cursor-pointer hover:border-[var(--border-default)] transition-colors">
                  <input
                    type="checkbox"
                    checked={!!cardFields.showAssignee}
                    onChange={(e) =>
                      setCardFields((prev) => ({ ...prev, showAssignee: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[var(--brand-primary)] cursor-pointer"
                  />
                  <div>
                    <div className="text-[13px] font-medium text-[var(--text-primary)]">Assignee Avatar</div>
                    <div className="text-[11px] text-[var(--text-muted)]">User avatar icon on the bottom right</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] cursor-pointer hover:border-[var(--border-default)] transition-colors">
                  <input
                    type="checkbox"
                    checked={!!cardFields.showPoints}
                    onChange={(e) =>
                      setCardFields((prev) => ({ ...prev, showPoints: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[var(--brand-primary)] cursor-pointer"
                  />
                  <div>
                    <div className="text-[13px] font-medium text-[var(--text-primary)]">Story Points</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Story point effort count badge</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] cursor-pointer hover:border-[var(--border-default)] transition-colors">
                  <input
                    type="checkbox"
                    checked={!!cardFields.showParent}
                    onChange={(e) =>
                      setCardFields((prev) => ({ ...prev, showParent: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[var(--brand-primary)] cursor-pointer"
                  />
                  <div>
                    <div className="text-[13px] font-medium text-[var(--text-primary)]">Parent Story</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Reference key of parent work item</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--text-primary)]">Board Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Frontend Team Board"
                  className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--text-primary)]">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description of this board..."
                  className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] min-h-[80px] focus:outline-none focus:border-[var(--border-focus)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--text-primary)]">Team Scope</label>
                <select
                  value={teamId || ''}
                  onChange={(e) => setTeamId(e.target.value || null)}
                  className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                >
                  <option value="">Project-Wide Scope (All Teams)</option>
                  {teams.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      Team: {t.name}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Restrict this board to items owned by a specific team, or leave project-wide.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-app)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateBoard.isPending || createBoard.isPending}
            className="px-4 py-2 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors"
          >
            {updateBoard.isPending || createBoard.isPending ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </>
  );
}
