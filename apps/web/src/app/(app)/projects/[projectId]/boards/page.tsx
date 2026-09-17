'use client';
import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useBoardWorkItems, WorkItem, useTransitionWorkItemState } from '@/hooks/useWorkItems';
import { useWorkItemStates } from '@/hooks/useWorkItemStates';
import { useProjectContext } from '@/app/(app)/projects/[projectId]/project-layout-client';
import { Board } from '@/components/Board';
import { StatesManager } from '@/components/StatesManager';
import { WorkItemDrawer } from '@/components/WorkItemDrawer';
import { SquareKanban, Search, Filter } from 'lucide-react';

export default function ProjectBoardPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { selectedTeamId } = useProjectContext();

  const [backlogLevel, setBacklogLevel] = useState<'EPIC' | 'FEATURE' | 'STORY'>('STORY');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [tags, setTags] = useState('');

  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  const typeFilter = useMemo(() => {
    if (backlogLevel === 'EPIC') return 'EPIC';
    if (backlogLevel === 'FEATURE') return 'FEATURE';
    return undefined;
  }, [backlogLevel]);

  const filters = useMemo(() => {
    const f: Record<string, string> = { limit: '1000' };
    if (debouncedSearch) f.search = debouncedSearch;
    if (assignedTo) f.assignedTo = assignedTo;
    if (tags) f.tags = tags;
    if (typeFilter) f.type = typeFilter;
    return f;
  }, [debouncedSearch, assignedTo, tags, typeFilter]);

  const { data: workItems = [], isLoading: isLoadingWorkItems, error } = useBoardWorkItems(projectId, selectedTeamId ?? 'default', filters);
  const { data: states = [] } = useWorkItemStates(projectId);
  const transitionWorkItem = useTransitionWorkItemState(projectId);

  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);

  const boardItems = useMemo(() => {
    return workItems.filter((item: WorkItem) => {
      if (backlogLevel === 'STORY') return item.type === 'STORY' || item.type === 'BUG';
      return true;
    });
  }, [workItems, backlogLevel]);

  const storyByParentId = useMemo(() => {
    const map: Record<string, { key: string; title: string }> = {};
    const byId = new Map<string, WorkItem>(workItems.map((item: WorkItem) => [item.id, item]));
    workItems.forEach((item: WorkItem) => {
      if (item.parentId && byId.has(item.parentId)) {
        map[item.parentId] = { key: byId.get(item.parentId)!.key, title: byId.get(item.parentId)!.title };
      }
    });
    return map;
  }, [workItems]);

  const handleDragState = (itemId: string, state: string) => {
    transitionWorkItem.mutate({ id: itemId, state });
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-shrink-0 bg-[var(--bg-app)] border-b border-[var(--border-subtle)] pb-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-[var(--radius-button)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center">
            <SquareKanban className="w-5 h-5" />
          </div>
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">Project Board</h1>
        </div>
        <p className="text-[14px] text-[var(--text-secondary)]">
          Board view of your work items across the entire project.
        </p>
      </div>

      <div className="flex-grow overflow-auto flex flex-col min-h-0">
        <div className="flex flex-wrap items-center justify-between mb-4 shrink-0 gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
              Board · <span className="text-[var(--text-secondary)] font-medium">{boardItems.length} {boardItems.length === 1 ? 'item' : 'items'}</span>
            </h2>
            <select
              value={backlogLevel}
              onChange={(e) => setBacklogLevel(e.target.value as 'EPIC' | 'FEATURE' | 'STORY')}
              className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2 py-1.5 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
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
                className="bg-transparent border-none focus:outline-none text-[13px] w-32"
              />
            </div>

            <div className="flex items-center gap-2 border border-[var(--border-default)] rounded-[var(--radius-input)] bg-[var(--bg-surface)] px-2 py-1">
              <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <input 
                type="text" 
                placeholder="Filter by tags (comma separated)..." 
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-[13px] w-48"
              />
            </div>
            
             <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2 py-1.5 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
            >
              <option value="">Any Assignee</option>
              <option value="UNASSIGNED">Unassigned</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <StatesManager projectId={projectId} />
          </div>
        </div>

        {isLoadingWorkItems ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[var(--text-muted)]">Loading board...</div>
        ) : error ? (
           <div className="text-[13px] text-[var(--priority-high)] p-8 text-center border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)]">
            Failed to load board: {(error as Error).message}
          </div>
        ) : boardItems.length === 0 ? (
          <div className="text-[13px] text-[var(--text-muted)] p-8 text-center border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)]">
            No items match the current filters.
          </div>
        ) : (
          <Board
            items={boardItems}
            states={states}
            onStateChange={handleDragState}
            onSelectItem={setSelectedItem}
            storyByParentId={storyByParentId}
          />
        )}
      </div>

      {selectedItem && (
        <WorkItemDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
