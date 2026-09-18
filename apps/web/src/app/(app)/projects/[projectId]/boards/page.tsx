'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useWorkItems, useTransitionWorkItemState } from '@/features/work-items/hooks/useWorkItems';
import { useWorkItemStates } from '@/features/work-items/hooks/useWorkItemStates';
import { useBoards } from '@/features/boards/hooks/useBoards';
import { BoardConfig } from '@/shared/types/boards';
import { WorkItem } from '@/shared/types/work-items';
import { useProjectContext } from '@/app/(app)/projects/[projectId]/project-layout-client';
import { Board } from '@/features/boards/components/Board';
import { BoardConfigModal } from '@/features/boards/components/BoardConfigModal';
import { StatesManager } from '@/features/boards/components/StatesManager';
import { WorkItemDrawer } from '@/features/work-items/components/WorkItemDrawer';
import { SquareKanban, Search, Filter, Settings2 } from 'lucide-react';
import { Spinner, ErrorState } from '@/shared/components/ui';

export default function ProjectBoardPage() {
  const params = useParams();
  const projectId = (params.projectId as string) || '';
  const { selectedTeamId } = useProjectContext();

  const { data: boards = [], isLoading: isLoadingBoards } = useBoards(projectId, selectedTeamId);
  const { data: states = [] } = useWorkItemStates(projectId);

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [boardToEdit, setBoardToEdit] = useState<BoardConfig | null>(null);

  const activeBoard = useMemo(() => {
    if (!boards || boards.length === 0) return null;
    if (selectedBoardId) {
      return boards.find((b) => b.id === selectedBoardId) || boards[0];
    }
    return boards[0];
  }, [boards, selectedBoardId]);

  const [backlogLevel, setBacklogLevel] = useState<'EPIC' | 'FEATURE' | 'STORY'>('STORY');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [tags, setTags] = useState('');

  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Apply the board's persisted filter defaults whenever the active board
  // changes (render-time adjustment, per React's "state derived from props"
  // guidance). Live edits by the user are left untouched.
  const [filteredBoardId, setFilteredBoardId] = useState<string | undefined>(activeBoard?.id);
  if (filteredBoardId !== activeBoard?.id) {
    setFilteredBoardId(activeBoard?.id);
    const cfg = activeBoard?.filterConfig || {};
    setBacklogLevel(cfg.backlogLevel ?? 'STORY');
    setSearch(cfg.search ?? '');
    setTags(cfg.tags ?? '');
    setAssignedTo(cfg.assignedTo ?? '');
  }

  const typeFilter = useMemo(() => {
    if (backlogLevel === 'EPIC') return 'EPIC';
    if (backlogLevel === 'FEATURE') return 'FEATURE';
    return undefined;
  }, [backlogLevel]);

  const {
    data: workItems = [],
    isLoading: isLoadingWorkItems,
    error,
  } = useWorkItems(projectId, selectedTeamId);

  const transitionWorkItem = useTransitionWorkItemState(projectId);
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);

  const boardItems = useMemo(() => {
    const allowedTypes = activeBoard?.filterConfig?.types;
    const searchQuery = debouncedSearch.trim().toLowerCase();
    const tagQuery = tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    return workItems.filter((item) => {
      if (backlogLevel === 'STORY') {
        if (item.type !== 'STORY' && item.type !== 'BUG') return false;
      } else if (typeFilter) {
        if (item.type !== typeFilter) return false;
      }
      if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.includes(item.type)) {
        return false;
      }
      if (searchQuery) {
        const haystack = `${item.title} ${item.key} ${item.description ?? ''}`.toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
      }
      if (tagQuery.length > 0) {
        const itemTags = (item.tags ?? []).map((t) => t.toLowerCase());
        if (!tagQuery.some((t) => itemTags.includes(t))) return false;
      }
      if (assignedTo === 'UNASSIGNED') {
        if (item.assignedTo) return false;
      } else if (assignedTo) {
        if (item.assignedTo !== assignedTo) return false;
      }
      return true;
    });
  }, [workItems, backlogLevel, typeFilter, activeBoard?.filterConfig?.types, debouncedSearch, tags, assignedTo]);

  const storyByParentId = useMemo(() => {
    const map: Record<string, { key: string; title: string }> = {};
    const byId = new Map<string, WorkItem>(workItems.map((item) => [item.id, item]));
    workItems.forEach((item) => {
      if (item.parentId && byId.has(item.parentId)) {
        map[item.parentId] = { key: byId.get(item.parentId)!.key, title: byId.get(item.parentId)!.title };
      }
    });
    return map;
  }, [workItems]);

  const handleDragState = (itemId: string, stateKey: string) => {
    transitionWorkItem.mutate({ id: itemId, state: stateKey });
  };

  const handleOpenConfig = (b: BoardConfig | null) => {
    setBoardToEdit(b);
    setIsConfigModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full w-full p-6">
      {/* Header */}
      <div className="flex-shrink-0 bg-[var(--bg-app)] border-b border-[var(--border-subtle)] pb-4 mb-4 flex justify-between items-start flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-[var(--radius-button)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center">
              <SquareKanban className="w-5 h-5" />
            </div>
            <h1 className="text-[22px] font-semibold text-[var(--text-primary)]">
              {activeBoard ? activeBoard.name : 'Project Board'}
            </h1>

            {/* Board Selector */}
            {boards.length > 0 && (
              <select
                value={activeBoard?.id || ''}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    handleOpenConfig(null);
                  } else {
                    setSelectedBoardId(e.target.value);
                  }
                }}
                className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1 text-[12px] font-medium bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.teamId ? '(Team Scoped)' : '(Project Wide)'}
                  </option>
                ))}
                <option value="__new__">+ Create New Board</option>
              </select>
            )}
          </div>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Configurable board view mapping columns and WIP limits to your reusable work-item workflow.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activeBoard && (
            <button
              onClick={() => handleOpenConfig(activeBoard)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-button)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
            >
              <Settings2 className="w-4 h-4 text-[var(--brand-primary)]" /> Configure Board
            </button>
          )}
          <StatesManager projectId={projectId} />
        </div>
      </div>

      {/* Main Board View Area */}
      <div className="flex-grow overflow-auto flex flex-col min-h-0">
        <div className="flex flex-wrap items-center justify-between mb-4 shrink-0 gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Board ·{' '}
              <span className="text-[var(--text-secondary)] font-medium">
                {boardItems.length} {boardItems.length === 1 ? 'item' : 'items'}
              </span>
            </h2>

            <select
              value={backlogLevel}
              onChange={(e) => setBacklogLevel(e.target.value as 'EPIC' | 'FEATURE' | 'STORY')}
              className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2 py-1.5 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
            >
              <option value="EPIC">Epics</option>
              <option value="FEATURE">Features</option>
              <option value="STORY">Stories & Bugs</option>
            </select>

            <div className="flex items-center gap-2 border border-[var(--border-default)] rounded-[var(--radius-input)] bg-[var(--bg-surface)] px-2 py-1">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search board..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-[13px] text-[var(--text-primary)] w-32"
              />
            </div>

            <div className="flex items-center gap-2 border border-[var(--border-default)] rounded-[var(--radius-input)] bg-[var(--bg-surface)] px-2 py-1">
              <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Filter by tags..."
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-[13px] text-[var(--text-primary)] w-36"
              />
            </div>

            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2 py-1.5 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
            >
              <option value="">Any Assignee</option>
              <option value="UNASSIGNED">Unassigned</option>
            </select>
          </div>
        </div>

        {isLoadingWorkItems || isLoadingBoards ? (
          <div className="flex flex-1 items-center justify-center p-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <ErrorState error={error} title="Failed to load board" />
        ) : (
          <Board
            items={boardItems}
            states={states}
            board={activeBoard}
            onStateChange={handleDragState}
            onSelectItem={setSelectedItem}
            storyByParentId={storyByParentId}
          />
        )}
      </div>

      {selectedItem && <WorkItemDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />}

      <BoardConfigModal
        projectId={projectId}
        board={boardToEdit}
        states={states}
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSaved={(bId) => setSelectedBoardId(bId)}
      />
    </div>
  );
}
