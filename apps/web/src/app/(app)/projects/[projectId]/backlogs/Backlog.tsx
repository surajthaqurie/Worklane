'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { BacklogItem, BacklogFilters } from '@/shared/types/backlogs';
import { WorkItem } from '@/shared/types/work-items';
import { useBacklogLevel, useReorderBacklogItem, useBulkAssignIteration } from '@/features/backlogs/hooks/useBacklog';
import { useUpdateWorkItem, useWorkItems } from '@/features/work-items/hooks/useWorkItems';
import { useWorkItemStates } from '@/features/work-items/hooks/useWorkItemStates';
import { useIterations } from '@/features/iterations/hooks/useIterations';
import { useProjectMembers } from '@/features/projects/hooks/useProjects';
import { useProjectContext } from '@/app/(app)/projects/[projectId]/project-layout-client';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { BacklogHeader } from '@/features/backlogs/components/BacklogHeader';
import { BacklogTable, FlatNode } from '@/features/backlogs/components/BacklogTable';
import { WorkItemDrawer } from '@/features/work-items/components/WorkItemDrawer';
import { CreateWorkItemModal } from '@/features/work-items/components/CreateWorkItemModal';
import { Spinner } from '@/shared/components/ui/Spinner';
import { computeRank } from '@/shared/utils/hierarchy';

export function Backlog({ projectId }: { projectId: string }) {
  const { selectedTeamId } = useProjectContext();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
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
      search: debouncedSearch || undefined,
      type: filterType || undefined,
      state: filterState || undefined,
      priority: filterPriority || undefined,
      assignedTo: filterAssignedTo || undefined,
      iterationId: filterIterationId === 'backlog' ? undefined : filterIterationId || undefined,
    }),
    [selectedTeamId, debouncedSearch, filterType, filterState, filterPriority, filterAssignedTo, filterIterationId]
  );

  const { data: topLevel, isLoading, error } = useBacklogLevel(projectId, filters);
  const { data: states = [] } = useWorkItemStates(projectId);
  const { data: iterations = [] } = useIterations(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const { data: allWorkItems = [] } = useWorkItems(projectId, selectedTeamId, { limit: '500' });

  const reorderMutation = useReorderBacklogItem(projectId, selectedTeamId);
  const bulkAssignMutation = useBulkAssignIteration(projectId, selectedTeamId);
  const updateMutation = useUpdateWorkItem(projectId);

  // Keyboard shortcut: Escape clears row selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds.size]);

  // Build tree nodes for top level items and expanded parent items
  const flatNodes: FlatNode[] = useMemo(() => {
    if (!topLevel?.items) return [];

    const result: FlatNode[] = [];
    const visited = new Set<string>();

    const addChildren = (parentId: string, currentDepth: number) => {
      const children = allWorkItems.filter((w) => w.parentId === parentId);
      for (const child of children) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);

        const backlogItem: BacklogItem = {
          ...child,
          assignedToName: child.assignedToName ?? null,
          assignedToAvatar: child.assignedToAvatar ?? null,
          completedAt: child.completedAt ?? null,
          iterationId: child.iterationId ?? null,
          backlogOrder: child.backlogOrder ?? 0,
          backlogRank: child.backlogRank ?? 0,
          childCount: child.childCount ?? 0,
          hasChildren: allWorkItems.some((w) => w.parentId === child.id),
          tags: child.tags ?? [],
        };
        result.push({ item: backlogItem, depth: currentDepth });
        if (expanded.has(child.id)) {
          addChildren(child.id, currentDepth + 1);
        }
      }
    };

    for (const item of topLevel.items) {
      if (visited.has(item.id)) continue;
      visited.add(item.id);
      result.push({ item, depth: 0 });
      if (expanded.has(item.id)) {
        addChildren(item.id, 1);
      }
    }

    return result;
  }, [topLevel, allWorkItems, expanded]);

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
      const next = new Set(prev);
      if (e.ctrlKey || e.metaKey) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        if (next.has(id) && next.size === 1) {
          next.clear();
        } else {
          next.clear();
          next.add(id);
        }
      }
      return next;
    });
  }, []);

  const handleToggleSelectRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
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

  const handleBulkAssignUser = useCallback(
    (userId: string | null) => {
      const itemIds = Array.from(selectedIds);
      itemIds.forEach((id) => {
        updateMutation.mutate({
          id,
          data: { assignedTo: userId },
        });
      });
      setSelectedIds(new Set());
    },
    [selectedIds, updateMutation]
  );

  const handleBulkAssignParent = useCallback(
    (parentId: string | null) => {
      const itemIds = Array.from(selectedIds);
      itemIds.forEach((id) => {
        updateMutation.mutate({
          id,
          data: { parentId },
        });
      });
      setSelectedIds(new Set());
    },
    [selectedIds, updateMutation]
  );

  const handleUpdateAssignee = useCallback(
    (id: string, assignedTo: string | null) => {
      updateMutation.mutate({
        id,
        data: { assignedTo },
      });
    },
    [updateMutation]
  );

  const handleUpdateState = useCallback(
    (id: string, state: string) => {
      updateMutation.mutate({
        id,
        data: { state },
      });
    },
    [updateMutation]
  );

  const handleUpdateParent = useCallback(
    (id: string, parentId: string | null) => {
      updateMutation.mutate({
        id,
        data: { parentId },
      });
    },
    [updateMutation]
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
    setEditDraft({ title: item.title, state: item.state, assignedTo: item.assignedTo, parentId: item.parentId });
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
            assignedTo: editDraft.assignedTo,
            parentId: editDraft.parentId,
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
        allWorkItems={allWorkItems}
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
        onBulkAssignUser={handleBulkAssignUser}
        onBulkAssignParent={handleBulkAssignParent}
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
        allWorkItems={allWorkItems}
        onToggleExpand={toggleExpand}
        onSelectRow={handleSelectRow}
        onToggleSelectRow={handleToggleSelectRow}
        onOpenDrawer={setDrawerItem}
        onAddChild={() => setIsCreateModalOpen(true)}
        onStartEditing={handleStartEditing}
        onCancelEditing={handleCancelEditing}
        onSaveEditing={handleSaveEditing}
        onDraftChange={handleDraftChange}
        onReorder={handleReorder}
        onSelectAllToggle={handleSelectAllToggle}
        onUpdateAssignee={handleUpdateAssignee}
        onUpdateState={handleUpdateState}
        onUpdateParent={handleUpdateParent}
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
