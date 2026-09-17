'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { BacklogItem, BacklogFilters } from '@/shared/types/backlogs';
import { WorkItem } from '@/shared/types/work-items';
import { useBacklogLevel, useReorderBacklogItem, useBulkAssignIteration } from '@/features/backlogs/hooks/useBacklog';
import { useCreateWorkItem, useUpdateWorkItem } from '@/features/work-items/hooks/useWorkItems';
import { useWorkItemStates } from '@/features/work-items/hooks/useWorkItemStates';
import { useIterations } from '@/features/iterations/hooks/useIterations';
import { useProjectMembers } from '@/features/projects/hooks/useProjects';
import { useProjectContext } from '@/app/(app)/projects/[projectId]/project-layout-client';
import { BacklogHeader } from '@/features/backlogs/components/BacklogHeader';
import { BacklogTable, FlatNode } from '@/features/backlogs/components/BacklogTable';
import { WorkItemDrawer } from '@/features/work-items/components/WorkItemDrawer';
import { CreateWorkItemModal } from '@/features/work-items/components/CreateWorkItemModal';
import { Spinner } from '@/shared/components/ui/Spinner';
import { computeRank } from '@/shared/utils/hierarchy';

export function Backlog({ projectId }: { projectId: string }) {
  const { selectedTeamId } = useProjectContext();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignedTo, setFilterAssignedTo] = useState('');
  const [filterIterationId, setFilterIterationId] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerItem, setDrawerItem] = useState<WorkItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<BacklogItem>>({});

  const filters: BacklogFilters = useMemo(
    () => ({
      parentId: null,
      teamId: selectedTeamId || undefined,
      search: search || undefined,
      type: filterType || undefined,
      state: filterState || undefined,
      priority: filterPriority || undefined,
      assignedTo: filterAssignedTo || undefined,
      iterationId: filterIterationId === 'backlog' ? undefined : filterIterationId || undefined,
    }),
    [selectedTeamId, search, filterType, filterState, filterPriority, filterAssignedTo, filterIterationId]
  );

  const { data: topLevel, isLoading, error } = useBacklogLevel(projectId, filters);
  const { data: states = [] } = useWorkItemStates(projectId);
  const { data: iterations = [] } = useIterations(projectId);
  const { data: members = [] } = useProjectMembers(projectId);

  const reorderMutation = useReorderBacklogItem(projectId, selectedTeamId);
  const bulkAssignMutation = useBulkAssignIteration(projectId, selectedTeamId);
  const updateMutation = useUpdateWorkItem(projectId);

  const flatNodes: FlatNode[] = useMemo(() => {
    if (!topLevel?.items) return [];
    return topLevel.items.map((item) => ({ item, depth: 0 }));
  }, [topLevel]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectRow = useCallback((id: string, e: React.MouseEvent) => {
    setSelectedIds((prev) => {
      const next = new Set(e.ctrlKey || e.metaKey ? prev : []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAllToggle = useCallback(
    (allSelected: boolean) => {
      if (allSelected) {
        setSelectedIds(new Set(flatNodes.map((n) => n.item.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [flatNodes]
  );

  const handleReorder = useCallback(
    (activeId: string, overId: string) => {
      const items = flatNodes.map((n) => n.item);
      const activeIdx = items.findIndex((i) => i.id === activeId);
      const overIdx = items.findIndex((i) => i.id === overId);
      if (activeIdx === -1 || overIdx === -1) return;

      const prevRank = overIdx > 0 ? items[overIdx - 1].backlogRank : null;
      const nextRank = items[overIdx].backlogRank;
      const newRank = computeRank(prevRank, nextRank);

      reorderMutation.mutate({
        id: activeId,
        parentId: null,
        newRank,
      });
    },
    [flatNodes, reorderMutation]
  );

  const handleStartEditing = useCallback((item: BacklogItem) => {
    setEditingId(item.id);
    setEditDraft({ title: item.title, state: item.state });
  }, []);

  const handleCancelEditing = useCallback(() => {
    setEditingId(null);
    setEditDraft({});
  }, []);

  const handleSaveEditing = useCallback(
    (item: BacklogItem) => {
      if (!editDraft.title?.trim()) {
        handleCancelEditing();
        return;
      }
      updateMutation.mutate(
        {
          id: item.id,
          data: {
            title: editDraft.title.trim(),
            state: editDraft.state,
          },
        },
        {
          onSettled: () => handleCancelEditing(),
        }
      );
    },
    [editDraft, updateMutation, handleCancelEditing]
  );

  const handleDraftChange = useCallback((field: keyof BacklogItem, value: unknown) => {
    setEditDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-xs text-rose-500">Failed to load backlog</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <BacklogHeader
        search={search}
        onSearchChange={setSearch}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((prev) => !prev)}
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        iterations={iterations}
        states={states}
        members={members}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        filterState={filterState}
        onFilterStateChange={setFilterState}
        filterPriority={filterPriority}
        onFilterPriorityChange={setFilterPriority}
        filterAssignedTo={filterAssignedTo}
        onFilterAssignedToChange={setFilterAssignedTo}
        filterIterationId={filterIterationId}
        onFilterIterationIdChange={setFilterIterationId}
        onBulkAssignIteration={(iterationId) => {
          bulkAssignMutation.mutate({
            itemIds: Array.from(selectedIds),
            iterationId,
          });
          setSelectedIds(new Set());
        }}
        onCreateNewItem={() => setIsCreateModalOpen(true)}
      />

      <BacklogTable
        nodes={flatNodes}
        expanded={expanded}
        selectedIds={selectedIds}
        editingId={editingId}
        editDraft={editDraft}
        states={states}
        iterations={iterations}
        members={members}
        onToggleExpand={toggleExpand}
        onSelectRow={handleSelectRow}
        onOpenDrawer={(item) => setDrawerItem(item as unknown as WorkItem)}
        onAddChild={() => setIsCreateModalOpen(true)}
        onStartEditing={handleStartEditing}
        onCancelEditing={handleCancelEditing}
        onSaveEditing={handleSaveEditing}
        onDraftChange={handleDraftChange}
        onReorder={handleReorder}
        onSelectAllToggle={handleSelectAllToggle}
      />

      {drawerItem && <WorkItemDrawer item={drawerItem} onClose={() => setDrawerItem(null)} />}

      <CreateWorkItemModal
        projectId={projectId}
        teamId={selectedTeamId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
