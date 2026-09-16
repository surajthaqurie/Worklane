'use client';

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useTransition,
} from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  GripVertical,
  Sidebar,
  Search,
  X,
  Filter,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  Check,
} from 'lucide-react';

import {
  BacklogItem,
  WorkItemType,
  WorkItemPriority,
  TYPE_LABELS,
  TYPE_COLORS,
  TYPE_BG,
  DEFAULT_CHILD_TYPE,
  PARENT_TYPES,
  computeRank,
  useBacklogLevel,
  useReorderBacklogItem,
  useBulkAssignIteration,
  BacklogFilters,
} from '@/hooks/useBacklog';
import {
  useCreateWorkItem,
  useUpdateWorkItem,
  useTransitionWorkItemState,
} from '@/hooks/useWorkItems';
import { useIterations, Iteration } from '@/hooks/useIterations';
import { useWorkItemStates } from '@/hooks/useWorkItemStates';
import { useProjectMembers, useAreas } from '@/hooks/useProjects';
import { WorkItemDrawer } from '@/components/WorkItemDrawer';

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<WorkItemPriority, string> = {
  LOW: '#94a3b8',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
  URGENT: '#dc2626',
};

const PRIORITY_LABELS: Record<WorkItemPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

const INDENT_PX = 20;

// ─── Flat-tree node (rendered) ────────────────────────────────────────────────

interface FlatNode {
  item: BacklogItem;
  depth: number;
  isLoading?: boolean; // children are loading
  parentExpanded: boolean;
}

// ─── Main Backlog Component ───────────────────────────────────────────────────

export function Backlog({ projectId }: { projectId: string }) {
  // ── Filter state ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignedTo, setFilterAssignedTo] = useState('');
  const [filterIterationId, setFilterIterationId] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const activeFilters: BacklogFilters = useMemo(() => {
    const f: BacklogFilters = { parentId: null };
    if (debouncedSearch) f.search = debouncedSearch;
    if (filterType) f.type = filterType;
    if (filterState) f.state = filterState;
    if (filterPriority) f.priority = filterPriority;
    if (filterAssignedTo) f.assignedTo = filterAssignedTo;
    if (filterIterationId) f.iterationId = filterIterationId;
    return f;
  }, [debouncedSearch, filterType, filterState, filterPriority, filterAssignedTo, filterIterationId]);

  const hasActiveFilters = !!(
    debouncedSearch || filterType || filterState || filterPriority || filterAssignedTo || filterIterationId
  );

  // ── Expand/collapse state ────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedItem, setSelectedItem] = useState<BacklogItem | null>(null);

  // ── Planning panel ────────────────────────────────────────────────────────
  const [isPlanningOpen, setIsPlanningOpen] = useState(false);

  // ── Inline create state ──────────────────────────────────────────────────
  const [creatingUnder, setCreatingUnder] = useState<{
    parentId: string | null;
    defaultType: WorkItemType;
  } | null>(null);

  // ── Inline edit state ────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<BacklogItem>>({});

  // ── DnD state ─────────────────────────────────────────────────────────────
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [isDraggingOverIteration, setIsDraggingOverIteration] = useState<string | null>(null);

  // ── Data hooks ────────────────────────────────────────────────────────────
  const rootQuery = useBacklogLevel(projectId, activeFilters);
  const { data: iterations = [] } = useIterations(projectId);
  const { data: states = [] } = useWorkItemStates(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const { data: areas = [] } = useAreas(projectId);

  const createWorkItem = useCreateWorkItem(projectId);
  const updateWorkItem = useUpdateWorkItem(projectId);
  const transitionState = useTransitionWorkItemState(projectId);
  const reorderItem = useReorderBacklogItem(projectId);
  const bulkAssignIteration = useBulkAssignIteration(projectId);

  // ── DnD sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Root items (flat, for this level) ─────────────────────────────────────
  const rootItems: BacklogItem[] = rootQuery.data?.items ?? [];

  // ── Handle create ────────────────────────────────────────────────────────
  const handleCreate = useCallback(
    async (title: string, type: WorkItemType, parentId: string | null) => {
      if (!title.trim()) return;
      await createWorkItem.mutateAsync({ title: title.trim(), type, parentId });
      setCreatingUnder(null);
      if (parentId && !expanded.has(parentId)) {
        setExpanded((prev) => new Set(prev).add(parentId));
      }
    },
    [createWorkItem, expanded],
  );

  // ── Handle inline edit save ───────────────────────────────────────────────
  const handleEditSave = useCallback(
    async (item: BacklogItem) => {
      const { state: newState, ...rest } = editDraft;
      const ops: Promise<any>[] = [];

      const fields: (keyof BacklogItem)[] = [
        'title', 'priority', 'points', 'assignedTo', 'iterationId', 'areaId',
      ];
      const changed: Record<string, any> = {};
      for (const f of fields) {
        if (editDraft[f] !== undefined && editDraft[f] !== (item as any)[f]) {
          changed[f] = editDraft[f];
        }
      }
      if (Object.keys(changed).length > 0) {
        ops.push(updateWorkItem.mutateAsync({ id: item.id, data: changed }));
      }
      if (newState && newState !== item.state) {
        ops.push(transitionState.mutateAsync({ id: item.id, state: newState }));
      }
      await Promise.all(ops);
      setEditingId(null);
      setEditDraft({});
    },
    [editDraft, updateWorkItem, transitionState],
  );

  // ── DnD handlers ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      setOverId(event.over?.id ?? null);
      const overId = event.over?.id?.toString() ?? '';
      if (overId.startsWith('iteration-drop-')) {
        setIsDraggingOverIteration(overId.replace('iteration-drop-', ''));
      } else {
        setIsDraggingOverIteration(null);
      }
    },
    [],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverId(null);
      setIsDraggingOverIteration(null);

      if (!over || active.id === over.id) return;

      const overId = over.id.toString();

      // ── Drop on iteration panel ─────────────────────────────────────────
      if (overId.startsWith('iteration-drop-')) {
        const iterationId = overId.replace('iteration-drop-', '');
        bulkAssignIteration.mutate({
          itemIds: [active.id.toString()],
          iterationId: iterationId === 'unassigned' ? null : iterationId,
        });
        return;
      }

      // ── Drop on a work item (reorder or reparent) ───────────────────────
      const activeItem = rootItems.find((i) => i.id === active.id.toString());
      const overItem = rootItems.find((i) => i.id === over.id.toString());

      if (!activeItem || !overItem) return;

      const siblings = rootItems.filter((i) => i.parentId === overItem.parentId);
      const overIdx = siblings.findIndex((i) => i.id === overItem.id);
      const prevItem = overIdx > 0 ? siblings[overIdx - 1] : null;

      const newRank = computeRank(
        prevItem?.backlogRank ?? null,
        overItem.backlogRank,
      );

      reorderItem.mutate({
        id: activeItem.id,
        parentId: overItem.parentId,
        newRank,
      });
    },
    [rootItems, bulkAssignIteration, reorderItem],
  );

  // ── Sortable IDs (flat list for top-level items) ──────────────────────────
  const sortableIds = useMemo(() => rootItems.map((i) => i.id), [rootItems]);

  // ── Dragging item ──────────────────────────────────────────────────────────
  const draggingItem = useMemo(
    () => rootItems.find((i) => i.id === activeId?.toString()) ?? null,
    [rootItems, activeId],
  );

  const hasFilters = hasActiveFilters;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col w-full h-full overflow-hidden">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 mb-4 border-b border-[var(--border-subtle)] shrink-0 gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-semibold text-[var(--text-primary)] leading-tight">
              Backlog
            </h1>
            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
              Plan and prioritize work. Epics → Features → Stories → Tasks & Bugs.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsPlanningOpen((p) => !p)}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-button)] transition-colors flex items-center gap-1.5 border ${
                isPlanningOpen
                  ? 'bg-[var(--bg-surface-selected)] text-[var(--brand-primary)] border-[var(--brand-primary)]/30'
                  : 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              <Sidebar className="w-3.5 h-3.5" />
              Planning
            </button>
            <button
              onClick={() => setCreatingUnder({ parentId: null, defaultType: 'EPIC' })}
              className="px-3 py-1.5 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Epic
            </button>
          </div>
        </div>

        {/* ── Filter bar ──────────────────────────────────────────────────── */}
        <BacklogFilterBar
          search={search}
          setSearch={setSearch}
          filterType={filterType}
          setFilterType={setFilterType}
          filterState={filterState}
          setFilterState={setFilterState}
          filterPriority={filterPriority}
          setFilterPriority={setFilterPriority}
          filterAssignedTo={filterAssignedTo}
          setFilterAssignedTo={setFilterAssignedTo}
          filterIterationId={filterIterationId}
          setFilterIterationId={setFilterIterationId}
          iterations={iterations}
          members={members}
          hasActiveFilters={hasActiveFilters}
          onClear={() => {
            setSearch('');
            setFilterType('');
            setFilterState('');
            setFilterPriority('');
            setFilterAssignedTo('');
            setFilterIterationId('');
          }}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
        />

        {/* ── Main layout ──────────────────────────────────────────────────── */}
        <div className="flex flex-1 gap-3 overflow-hidden min-h-0">
          {/* ── Tree ──────────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] flex flex-col overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_90px_110px_110px_130px_80px_36px] gap-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]">
              <div className="py-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Title
              </div>
              <div className="py-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Type
              </div>
              <div className="py-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                State
              </div>
              <div className="py-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Assignee
              </div>
              <div className="py-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Iteration
              </div>
              <div className="py-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-center">
                Pts
              </div>
              <div />
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {rootQuery.isLoading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-[var(--text-muted)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-[13px]">Loading backlog…</span>
                </div>
              ) : rootQuery.error ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <AlertCircle className="w-5 h-5 text-[var(--priority-high)]" />
                  <span className="text-[13px] text-[var(--priority-high)]">
                    Failed to load backlog
                  </span>
                </div>
              ) : (
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  {/* Inline create at root */}
                  {creatingUnder?.parentId === null && (
                    <InlineCreateRow
                      depth={0}
                      defaultType={creatingUnder.defaultType}
                      onSave={handleCreate}
                      onCancel={() => setCreatingUnder(null)}
                      parentId={null}
                    />
                  )}

                  {rootItems.map((item, idx) => (
                    <BacklogRow
                      key={item.id}
                      item={item}
                      depth={0}
                      projectId={projectId}
                      expanded={expanded}
                      onToggleExpand={toggleExpand}
                      editingId={editingId}
                      editDraft={editDraft}
                      onStartEdit={(item) => {
                        setEditingId(item.id);
                        setEditDraft({ ...item });
                      }}
                      onEditDraftChange={setEditDraft}
                      onEditSave={handleEditSave}
                      onEditCancel={() => { setEditingId(null); setEditDraft({}); }}
                      onSelect={setSelectedItem}
                      onStartCreate={(parentId, type) => {
                        setCreatingUnder({ parentId, defaultType: type });
                        setExpanded((prev) => new Set(prev).add(parentId));
                      }}
                      creatingUnder={creatingUnder}
                      onSaveCreate={handleCreate}
                      onCancelCreate={() => setCreatingUnder(null)}
                      states={states}
                      iterations={iterations}
                      members={members}
                      areas={areas}
                      updateWorkItem={updateWorkItem}
                      transitionState={transitionState}
                      prevItem={rootItems[idx - 1] ?? null}
                      nextItem={rootItems[idx + 1] ?? null}
                      isDragging={activeId === item.id}
                    />
                  ))}

                  {rootItems.length === 0 && !creatingUnder && !rootQuery.isLoading && (
                    <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                      {hasFilters ? (
                        <>
                          <Search className="w-8 h-8 text-[var(--text-muted)]" />
                          <p className="text-[14px] text-[var(--text-secondary)] font-medium">
                            No items match your filters.
                          </p>
                          <p className="text-[13px] text-[var(--text-muted)]">
                            Try adjusting or clearing the filters.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center">
                            <Plus className="w-5 h-5 text-[var(--text-muted)]" />
                          </div>
                          <p className="text-[14px] text-[var(--text-secondary)] font-medium">
                            Your backlog is empty.
                          </p>
                          <p className="text-[13px] text-[var(--text-muted)]">
                            Create an Epic to get started.
                          </p>
                          <button
                            onClick={() =>
                              setCreatingUnder({ parentId: null, defaultType: 'EPIC' })
                            }
                            className="px-3 py-1.5 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)] transition-colors"
                          >
                            + New Epic
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </SortableContext>
              )}
            </div>

            {/* Footer: total count */}
            {rootQuery.data && rootQuery.data.total > 0 && (
              <div className="border-t border-[var(--border-subtle)] px-4 py-2 text-[11px] text-[var(--text-muted)] shrink-0">
                {rootQuery.data.total} item{rootQuery.data.total !== 1 ? 's' : ''} at this level
                {rootQuery.data.total > (rootQuery.data.items?.length ?? 0) && (
                  <span className="ml-1">
                    · showing {rootQuery.data.items?.length ?? 0}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Planning panel ─────────────────────────────────────────────── */}
          {isPlanningOpen && (
            <PlanningPanel
              iterations={iterations}
              isDraggingOver={isDraggingOverIteration}
            />
          )}
        </div>
      </div>

      {/* ── Drag overlay ────────────────────────────────────────────────────── */}
      <DragOverlay dropAnimation={null}>
        {draggingItem ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--brand-primary)] rounded-[var(--radius-card)] px-4 py-2 shadow-lg text-[13px] font-medium text-[var(--text-primary)] flex items-center gap-2 opacity-90">
            <TypeBadge type={draggingItem.type} />
            <span className="truncate max-w-[280px]">{draggingItem.title}</span>
          </div>
        ) : null}
      </DragOverlay>

      {/* ── Work item drawer ─────────────────────────────────────────────────── */}
      {selectedItem && (
        <WorkItemDrawer
          item={selectedItem as any}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </DndContext>
  );
}

// ─── BacklogRow ───────────────────────────────────────────────────────────────

interface BacklogRowProps {
  item: BacklogItem;
  depth: number;
  projectId: string;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  editingId: string | null;
  editDraft: Partial<BacklogItem>;
  onStartEdit: (item: BacklogItem) => void;
  onEditDraftChange: (draft: Partial<BacklogItem>) => void;
  onEditSave: (item: BacklogItem) => Promise<void>;
  onEditCancel: () => void;
  onSelect: (item: BacklogItem) => void;
  onStartCreate: (parentId: string, type: WorkItemType) => void;
  creatingUnder: { parentId: string | null; defaultType: WorkItemType } | null;
  onSaveCreate: (title: string, type: WorkItemType, parentId: string | null) => Promise<void>;
  onCancelCreate: () => void;
  states: { key: string; name: string; color: string; is_done?: boolean }[];
  iterations: Iteration[];
  members: { userId: string; name: string; avatarUrl?: string | null }[];
  areas: { id: string; name: string }[];
  updateWorkItem: ReturnType<typeof useUpdateWorkItem>;
  transitionState: ReturnType<typeof useTransitionWorkItemState>;
  prevItem: BacklogItem | null;
  nextItem: BacklogItem | null;
  isDragging: boolean;
}

function BacklogRow({
  item,
  depth,
  projectId,
  expanded,
  onToggleExpand,
  editingId,
  editDraft,
  onStartEdit,
  onEditDraftChange,
  onEditSave,
  onEditCancel,
  onSelect,
  onStartCreate,
  creatingUnder,
  onSaveCreate,
  onCancelCreate,
  states,
  iterations,
  members,
  areas,
  updateWorkItem,
  transitionState,
  isDragging,
}: BacklogRowProps) {
  const isExpanded = expanded.has(item.id);
  const isEditing = editingId === item.id;

  // Load children lazily when expanded
  const childrenQuery = useBacklogLevel(
    projectId,
    { parentId: item.id },
    { enabled: isExpanded },
  );
  const children = childrenQuery.data?.items ?? [];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  const childType = DEFAULT_CHILD_TYPE[item.type];
  const stateInfo = states.find((s) => s.key === item.state);
  const iterationName = iterations.find((i) => i.id === item.iterationId)?.name;
  const assigneeName = item.assignedToName || (item.assignedTo ? item.assignedTo.slice(0, 8) : null);

  const indentPx = depth * INDENT_PX;

  return (
    <React.Fragment>
      {/* ── Row ──────────────────────────────────────────────────────────────── */}
      <div
        ref={setNodeRef}
        style={style}
        className={`group grid grid-cols-[1fr_90px_110px_110px_130px_80px_36px] gap-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] transition-colors items-center cursor-pointer ${
          isSortableDragging ? 'opacity-40 bg-[var(--bg-surface-hover)]' : ''
        }`}
        onClick={() => {
          if (!isEditing) onSelect(item);
        }}
      >
        {/* Title cell */}
        <div
          className="flex items-center gap-1.5 py-2 pr-2 min-w-0"
          style={{ paddingLeft: `${indentPx + 8}px` }}
        >
          {/* Drag handle */}
          <button
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5"
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()}
            title="Drag to reorder"
          >
            <GripVertical className="w-3 h-3" />
          </button>

          {/* Expand toggle */}
          <button
            className="shrink-0 w-4 h-4 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              if (item.hasChildren || children.length > 0) onToggleExpand(item.id);
            }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {item.hasChildren || children.length > 0 ? (
              isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )
            ) : (
              <span className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Key + Title */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-[11px] text-[var(--text-muted)] font-mono shrink-0">
              {item.key}
            </span>
            {isEditing ? (
              <input
                autoFocus
                className="flex-1 border border-[var(--border-focus)] px-2 py-0.5 rounded-[var(--radius-input)] text-[13px] bg-[var(--bg-surface)] focus:outline-none min-w-0"
                value={editDraft.title ?? item.title}
                onChange={(e) => onEditDraftChange({ ...editDraft, title: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onEditSave(item);
                  if (e.key === 'Escape') onEditCancel();
                }}
              />
            ) : (
              <span
                className="text-[13px] text-[var(--text-primary)] font-medium truncate"
                title={item.title}
              >
                {item.title}
              </span>
            )}
          </div>
        </div>

        {/* Type */}
        <div className="py-2 px-2">
          <TypeBadge type={item.type} />
        </div>

        {/* State */}
        <div className="py-2 px-2">
          {isEditing ? (
            <select
              className="w-full border border-[var(--border-default)] px-1.5 py-0.5 rounded-[var(--radius-input)] text-[12px] bg-[var(--bg-surface)] focus:outline-none"
              value={editDraft.state ?? item.state}
              onChange={(e) => onEditDraftChange({ ...editDraft, state: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            >
              {states.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-secondary)]"
            >
              {stateInfo && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: stateInfo.color }}
                />
              )}
              <span className="truncate">{item.state}</span>
            </span>
          )}
        </div>

        {/* Assignee */}
        <div className="py-2 px-2">
          {isEditing ? (
            <select
              className="w-full border border-[var(--border-default)] px-1.5 py-0.5 rounded-[var(--radius-input)] text-[12px] bg-[var(--bg-surface)] focus:outline-none"
              value={editDraft.assignedTo ?? item.assignedTo ?? ''}
              onChange={(e) =>
                onEditDraftChange({ ...editDraft, assignedTo: e.target.value || null })
              }
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : assigneeName ? (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[9px] text-[var(--text-primary)] font-medium shrink-0">
                {assigneeName.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-[12px] text-[var(--text-secondary)] truncate">
                {assigneeName}
              </span>
            </div>
          ) : (
            <span className="text-[12px] text-[var(--text-muted)]">—</span>
          )}
        </div>

        {/* Iteration */}
        <div className="py-2 px-2">
          {isEditing ? (
            <select
              className="w-full border border-[var(--border-default)] px-1.5 py-0.5 rounded-[var(--radius-input)] text-[12px] bg-[var(--bg-surface)] focus:outline-none"
              value={editDraft.iterationId ?? item.iterationId ?? ''}
              onChange={(e) =>
                onEditDraftChange({ ...editDraft, iterationId: e.target.value || null })
              }
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">No Iteration</option>
              {iterations.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[12px] text-[var(--text-secondary)] truncate block" title={iterationName}>
              {iterationName ?? <span className="text-[var(--text-muted)]">—</span>}
            </span>
          )}
        </div>

        {/* Story points */}
        <div className="py-2 px-2 text-center">
          {isEditing ? (
            <input
              type="number"
              min={0}
              className="w-full border border-[var(--border-default)] px-1.5 py-0.5 rounded-[var(--radius-input)] text-[12px] bg-[var(--bg-surface)] focus:outline-none text-center"
              value={editDraft.points ?? item.points ?? ''}
              onChange={(e) =>
                onEditDraftChange({
                  ...editDraft,
                  points: e.target.value ? parseInt(e.target.value, 10) : null,
                })
              }
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-[12px] font-mono text-[var(--text-secondary)]">
              {item.points ?? <span className="text-[var(--text-muted)]">—</span>}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="py-2 flex items-center justify-center">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await onEditSave(item);
                }}
                className="p-1 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--brand-primary)]"
                title="Save"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditCancel();
                }}
                className="p-1 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)]"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <RowActionMenu
              item={item}
              childType={childType}
              onEdit={() => onStartEdit(item)}
              onAddChild={
                childType ? () => onStartCreate(item.id, childType) : undefined
              }
              onAddSibling={() => {
                // Create sibling: same type as this item, under the same parent
                onStartCreate(item.parentId ?? '', item.type);
              }}
            />
          )}
        </div>
      </div>

      {/* ── Inline create child row ────────────────────────────────────────── */}
      {creatingUnder?.parentId === item.id && (
        <InlineCreateRow
          depth={depth + 1}
          defaultType={creatingUnder.defaultType}
          parentId={item.id}
          onSave={onSaveCreate}
          onCancel={onCancelCreate}
        />
      )}

      {/* ── Children ─────────────────────────────────────────────────────────── */}
      {isExpanded && (
        <>
          {childrenQuery.isLoading && (
            <div
              className="flex items-center gap-2 py-2 border-b border-[var(--border-subtle)] text-[var(--text-muted)]"
              style={{ paddingLeft: `${(depth + 1) * INDENT_PX + 32}px` }}
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[12px]">Loading…</span>
            </div>
          )}
          <SortableContext
            items={children.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {children.map((child, idx) => (
              <BacklogRow
                key={child.id}
                item={child}
                depth={depth + 1}
                projectId={projectId}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
                editingId={editingId}
                editDraft={editDraft}
                onStartEdit={onStartEdit}
                onEditDraftChange={onEditDraftChange}
                onEditSave={onEditSave}
                onEditCancel={onEditCancel}
                onSelect={onSelect}
                onStartCreate={onStartCreate}
                creatingUnder={creatingUnder}
                onSaveCreate={onSaveCreate}
                onCancelCreate={onCancelCreate}
                states={states}
                iterations={iterations}
                members={members}
                areas={areas}
                updateWorkItem={updateWorkItem}
                transitionState={transitionState}
                prevItem={children[idx - 1] ?? null}
                nextItem={children[idx + 1] ?? null}
                isDragging={false}
              />
            ))}
          </SortableContext>
          {children.length === 0 && !childrenQuery.isLoading && (
            <div
              className="py-2 border-b border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] italic"
              style={{ paddingLeft: `${(depth + 1) * INDENT_PX + 32}px` }}
            >
              No children
              {childType && (
                <button
                  className="ml-2 text-[var(--brand-primary)] hover:underline not-italic"
                  onClick={() => onStartCreate(item.id, childType)}
                >
                  + Add {TYPE_LABELS[childType]}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </React.Fragment>
  );
}

// ─── InlineCreateRow ─────────────────────────────────────────────────────────

function InlineCreateRow({
  depth,
  defaultType,
  parentId,
  onSave,
  onCancel,
}: {
  depth: number;
  defaultType: WorkItemType;
  parentId: string | null;
  onSave: (title: string, type: WorkItemType, parentId: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<WorkItemType>(defaultType);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const validChildTypes: WorkItemType[] = parentId
    ? (Object.keys(PARENT_TYPES) as WorkItemType[]).filter((t) =>
        PARENT_TYPES[t].length === 0 || PARENT_TYPES[t].includes(type),
      )
    : ['EPIC', 'FEATURE', 'STORY', 'TASK', 'BUG'];

  const handleSave = async () => {
    if (!title.trim()) return;
    await onSave(title, type, parentId);
  };

  return (
    <div
      className="flex items-center gap-2 py-2 px-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-selected)]"
      style={{ paddingLeft: `${depth * INDENT_PX + 12}px` }}
    >
      <select
        className="border border-[var(--border-default)] px-2 py-1 rounded-[var(--radius-input)] text-[12px] bg-[var(--bg-surface)] focus:outline-none shrink-0"
        value={type}
        onChange={(e) => setType(e.target.value as WorkItemType)}
      >
        <option value="EPIC">Epic</option>
        <option value="FEATURE">Feature</option>
        <option value="STORY">User Story</option>
        <option value="TASK">Task</option>
        <option value="BUG">Bug</option>
      </select>
      <input
        ref={inputRef}
        placeholder="Enter title…"
        className="flex-1 border border-[var(--border-focus)] px-3 py-1 rounded-[var(--radius-input)] text-[13px] bg-[var(--bg-surface)] focus:outline-none min-w-0"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button
        onClick={handleSave}
        className="px-3 py-1 bg-[var(--brand-primary)] text-white text-[12px] font-medium rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)] shrink-0"
      >
        Save
      </button>
      <button
        onClick={onCancel}
        className="px-2 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[12px] shrink-0"
      >
        Cancel
      </button>
    </div>
  );
}

// ─── RowActionMenu ────────────────────────────────────────────────────────────

function RowActionMenu({
  item,
  childType,
  onEdit,
  onAddChild,
  onAddSibling,
}: {
  item: BacklogItem;
  childType: WorkItemType | null;
  onEdit: () => void;
  onAddChild?: () => void;
  onAddSibling?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((p) => !p);
        }}
        className="p-1 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        title="Actions"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-50 w-44 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-card)] shadow-lg py-1 text-[13px]">
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)]"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onEdit();
            }}
          >
            Edit inline
          </button>
          {onAddChild && childType && (
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onAddChild();
              }}
            >
              + Add {TYPE_LABELS[childType]}
            </button>
          )}
          {onAddSibling && (
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onAddSibling();
              }}
            >
              + Add sibling {TYPE_LABELS[item.type]}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TypeBadge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: WorkItemType }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0"
      style={{ color: TYPE_COLORS[type], backgroundColor: TYPE_BG[type] }}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

// ─── BacklogFilterBar ────────────────────────────────────────────────────────

function BacklogFilterBar({
  search,
  setSearch,
  filterType,
  setFilterType,
  filterState,
  setFilterState,
  filterPriority,
  setFilterPriority,
  filterAssignedTo,
  setFilterAssignedTo,
  filterIterationId,
  setFilterIterationId,
  iterations,
  members,
  hasActiveFilters,
  onClear,
  showFilters,
  setShowFilters,
}: {
  search: string;
  setSearch: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterState: string;
  setFilterState: (v: string) => void;
  filterPriority: string;
  setFilterPriority: (v: string) => void;
  filterAssignedTo: string;
  setFilterAssignedTo: (v: string) => void;
  filterIterationId: string;
  setFilterIterationId: (v: string) => void;
  iterations: Iteration[];
  members: { userId: string; name: string }[];
  hasActiveFilters: boolean;
  onClear: () => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
}) {
  return (
    <div className="mb-3 shrink-0 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by title, key, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-8 py-1.5 text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] w-72 focus:outline-none focus:border-[var(--border-focus)] transition-colors placeholder:text-[var(--text-muted)]"
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              onClick={() => setSearch('')}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-2.5 py-1.5 text-[13px] font-medium rounded-[var(--radius-button)] transition-colors flex items-center gap-1.5 border ${
            showFilters || hasActiveFilters
              ? 'bg-[var(--bg-surface-selected)] text-[var(--brand-primary)] border-[var(--brand-primary)]/30'
              : 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {hasActiveFilters && (
            <span className="w-4 h-4 rounded-full bg-[var(--brand-primary)] text-white text-[9px] flex items-center justify-center font-bold">
              ✓
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="px-2 py-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear all
          </button>
        )}
      </div>

      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap pl-0.5">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]"
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
            onChange={(e) => setFilterState(e.target.value)}
            className="px-2.5 py-1.5 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]"
          >
            <option value="">All States</option>
            <option value="New">New</option>
            <option value="Active">Active</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-2.5 py-1.5 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]"
          >
            <option value="">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={filterAssignedTo}
            onChange={(e) => setFilterAssignedTo(e.target.value)}
            className="px-2.5 py-1.5 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]"
          >
            <option value="">All Assignees</option>
            <option value="UNASSIGNED">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            value={filterIterationId}
            onChange={(e) => setFilterIterationId(e.target.value)}
            className="px-2.5 py-1.5 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]"
          >
            <option value="">All Iterations</option>
            <option value="null">Backlog (Unassigned)</option>
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

// ─── PlanningPanel ────────────────────────────────────────────────────────────

function PlanningPanel({
  iterations,
  isDraggingOver,
}: {
  iterations: Iteration[];
  isDraggingOver: string | null;
}) {
  return (
    <div className="w-64 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] flex flex-col overflow-hidden shrink-0">
      <div className="py-3 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] shrink-0">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Planning</h3>
        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
          Drag items here to assign an iteration.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        <IterationDropZone
          id="unassigned"
          label="Backlog (Unassigned)"
          subtitle="No iteration"
          isOver={isDraggingOver === 'unassigned'}
        />
        {iterations.map((it) => (
          <IterationDropZone
            key={it.id}
            id={it.id}
            label={it.name}
            subtitle={
              it.startDate && it.endDate
                ? `${format(new Date(it.startDate), 'MMM d')} – ${format(new Date(it.endDate), 'MMM d')}`
                : it.state
            }
            isOver={isDraggingOver === it.id}
            state={it.state}
          />
        ))}
      </div>
    </div>
  );
}

function IterationDropZone({
  id,
  label,
  subtitle,
  isOver,
  state,
}: {
  id: string;
  label: string;
  subtitle?: string;
  isOver: boolean;
  state?: string;
}) {
  const { setNodeRef } = useDroppable({ id: `iteration-drop-${id}` });

  return (
    <div
      ref={setNodeRef}
      className={`p-3 border rounded-[var(--radius-card)] transition-all ${
        isOver
          ? 'bg-[var(--brand-primary)]/10 border-[var(--brand-primary)] shadow-sm'
          : 'bg-[var(--bg-surface)] border-[var(--border-default)]'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <h4
          className={`text-[13px] font-semibold truncate ${
            isOver ? 'text-[var(--brand-primary)]' : 'text-[var(--text-primary)]'
          }`}
        >
          {label}
        </h4>
        {state && (
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${
              state === 'ACTIVE'
                ? 'bg-green-100 text-green-700'
                : state === 'COMPLETED'
                ? 'bg-[var(--bg-surface-hover)] text-[var(--text-muted)]'
                : 'bg-blue-50 text-blue-600'
            }`}
          >
            {state}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
      )}
      {isOver && (
        <p className="text-[11px] text-[var(--brand-primary)] mt-1.5 font-medium">
          Drop to assign
        </p>
      )}
    </div>
  );
}

// Need to import useDroppable from dnd-kit for the planning panel
import { useDroppable } from '@dnd-kit/core';
