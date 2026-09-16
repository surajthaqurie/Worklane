'use client';

import React, { useState, useMemo } from 'react';
import { useWorkItems, useWorkItemChildren, useCreateWorkItem, useUpdateWorkItem, useTransitionWorkItemState, WorkItem } from '@/hooks/useWorkItems';
import { useIterations, Iteration } from '@/hooks/useIterations';
import { useWorkItemStates } from '@/hooks/useWorkItemStates';
import { WorkItemDrawer } from '@/components/WorkItemDrawer';
import { WorkItemFilters, useWorkItemFilters } from '@/components/WorkItemFilters';
import { Board } from '@/components/Board';
import { StatesManager } from '@/components/StatesManager';
import { ChevronRight, ChevronDown, Plus, GripVertical, Sidebar, List, LayoutGrid } from 'lucide-react';
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';
import { format } from 'date-fns';

export function Backlog({ projectId }: { projectId: string }) {
  const filters = useWorkItemFilters();
  const { data: roots = [], isLoading, error } = useWorkItems(projectId, { ...filters, parentId: 'null' });
  const { data: iterations = [], error: iterationsError, refetch: refetchIterations } = useIterations(projectId);
  const { data: states = [] } = useWorkItemStates(projectId);
  const createWorkItem = useCreateWorkItem(projectId);
  const updateWorkItem = useUpdateWorkItem(projectId);
  const transitionWorkItem = useTransitionWorkItemState(projectId);

  const [view, setView] = useState<'list' | 'board'>('list');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [isPlanningOpen, setIsPlanningOpen] = useState(false);


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    if (over.id.toString().startsWith('iteration-')) {
      const iterationId = over.data.current?.iterationId;
      const itemId = active.id.toString();
      if (iterationId !== undefined) {
        updateWorkItem.mutate({ id: itemId, data: { iterationId: iterationId === 'unassigned' ? null : iterationId } });
      }
    } else if (over.id.toString().startsWith('item-')) {
      // Reordering or changing parent
      const itemId = active.id.toString();
      const targetId = over.id.toString().replace('item-', '');
      if (itemId !== targetId) {
        // Change parent to target item (making it a child)
        updateWorkItem.mutate({ id: itemId, data: { parentId: targetId } });
      }
    }
  };

  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<{title: string, type: WorkItem['type']}>({ title: '', type: 'STORY' });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<WorkItem>>({});


  const storyByParentId = useMemo(() => {
    const map: Record<string, { key: string; title: string }> = {};
    const byId = new Map<string, WorkItem>(roots.map((item: WorkItem) => [item.id, item]));
    roots.forEach((item: WorkItem) => {
      if (item.parentId && byId.has(item.parentId)) {
        map[item.parentId] = { key: byId.get(item.parentId)!.key, title: byId.get(item.parentId)!.title };
      }
    });
    return map;
  }, [roots]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveCreate = async () => {
    if (!createForm.title.trim()) return;
    
    await createWorkItem.mutateAsync({
      ...createForm,
      parentId: creatingParentId === 'root' ? null : creatingParentId
    });
    
    setCreateForm({ title: '', type: 'STORY' });
    setCreatingParentId(null);
  };

  if (isLoading) return <div className="text-[13px] text-[var(--text-muted)]">Loading backlog...</div>;
  if (error) return <div className="text-[13px] text-[var(--priority-high)]">Failed to load backlog</div>;

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col w-full h-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-4 border-b border-[var(--border-subtle)] shrink-0">
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">Backlog</h1>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Prioritize and plan your upcoming work.</p>
          </div>
          <div className="mt-4 flex md:ml-4 md:mt-0 gap-3">
            <div className="flex items-center bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] p-0.5 border border-[var(--border-subtle)]">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-button)] transition-colors flex items-center gap-1.5 ${view === 'list' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              >
                <List className="w-4 h-4" /> List
              </button>
              <button
                onClick={() => setView('board')}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-button)] transition-colors flex items-center gap-1.5 ${view === 'board' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              >
                <LayoutGrid className="w-4 h-4" /> Board
              </button>
            </div>
            <button 
              onClick={() => setIsPlanningOpen(!isPlanningOpen)}
              className={`px-3 py-2 text-[13px] font-medium rounded-[var(--radius-button)] transition-colors flex items-center gap-2 ${isPlanningOpen ? 'bg-[var(--bg-surface-selected)] text-[var(--brand-primary)]' : 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]'}`}
            >
              <Sidebar className="w-4 h-4" /> Planning
            </button>
            <StatesManager projectId={projectId} />
            <button 
              onClick={() => setCreatingParentId('root')}
              className="px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors"
            >
              + New Root Item
            </button>
          </div>
        </div>

        <WorkItemFilters />

        <div className="flex flex-1 overflow-hidden gap-4 mb-4">
          {view === 'board' ? (
            <div className="flex-1 min-w-0 overflow-auto bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-3">
              {creatingParentId === 'root' && (
                <div className="flex items-center gap-3 py-2.5 px-3 mb-3 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface-selected)]">
                  <select
                    className="border border-[var(--border-default)] px-2 py-1 rounded-[var(--radius-input)] text-[12px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                    value={createForm.type}
                    onChange={e => setCreateForm({ ...createForm, type: e.target.value as WorkItem['type'] })}
                  >
                    <option value="EPIC">Epic</option>
                    <option value="FEATURE">Feature</option>
                    <option value="STORY">Story</option>
                    <option value="TASK">Task</option>
                    <option value="BUG">Bug</option>
                  </select>
                  <input
                    autoFocus
                    placeholder="Title..."
                    className="border border-[var(--border-default)] px-3 py-1.5 rounded-[var(--radius-input)] w-64 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                    value={createForm.title}
                    onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveCreate();
                      if (e.key === 'Escape') setCreatingParentId(null);
                    }}
                  />
                  <button onClick={handleSaveCreate} className="bg-[var(--brand-primary)] text-white px-3 py-1.5 rounded-[var(--radius-button)] text-[12px] font-medium hover:bg-[var(--brand-primary-hover)]">Save</button>
                  <button onClick={() => setCreatingParentId(null)} className="px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[12px] font-medium">Cancel</button>
                </div>
              )}
              <Board
                items={roots}
                states={states}
                onStateChange={(itemId, state) => transitionWorkItem.mutate({ id: itemId, state })}
                onSelectItem={setSelectedItem}
                storyByParentId={storyByParentId}
              />
            </div>
          ) : (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] overflow-hidden flex-1 flex flex-col">
            <div className="grid grid-cols-[auto_100px_1fr_100px_100px_100px_120px_120px_100px] gap-4 py-2.5 px-4 bg-[var(--bg-surface-hover)] border-b border-[var(--border-subtle)] font-medium text-[11px] text-[var(--text-secondary)] uppercase tracking-wider sticky top-0 z-10">
              <div style={{ width: '40px' }} />
              <div>Key</div>
              <div>Title</div>
              <div>Type</div>
              <div>State</div>
              <div>Priority</div>
              <div>Assignee</div>
              <div>Iteration</div>
              <div>Actions</div>
            </div>

            <div className="flex flex-col overflow-y-auto">
              {creatingParentId === 'root' && (
                <div className="flex items-center gap-3 py-2.5 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-selected)]">
                  <div style={{ width: '40px' }} />
                  <select
                    className="border border-[var(--border-default)] px-2 py-1 rounded-[var(--radius-input)] text-[12px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                    value={createForm.type}
                    onChange={e => setCreateForm({ ...createForm, type: e.target.value as WorkItem['type'] })}
                  >
                    <option value="EPIC">Epic</option>
                    <option value="FEATURE">Feature</option>
                    <option value="STORY">Story</option>
                    <option value="TASK">Task</option>
                    <option value="BUG">Bug</option>
                  </select>
                  <input
                    autoFocus
                    placeholder="Title..."
                    className="border border-[var(--border-default)] px-3 py-1.5 rounded-[var(--radius-input)] w-64 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                    value={createForm.title}
                    onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveCreate();
                      if (e.key === 'Escape') setCreatingParentId(null);
                    }}
                  />
                  <button onClick={handleSaveCreate} className="bg-[var(--brand-primary)] text-white px-3 py-1.5 rounded-[var(--radius-button)] text-[12px] font-medium hover:bg-[var(--brand-primary-hover)]">Save</button>
                  <button onClick={() => setCreatingParentId(null)} className="px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[12px] font-medium">Cancel</button>
                </div>
              )}

              {roots.map((item: WorkItem) => (
                <WorkItemRow 
                  key={item.id} 
                  item={item} 
                  depth={0} 
                                    expanded={expanded}
                  setExpanded={setExpanded} 
                  toggleExpand={toggleExpand}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  setSelectedItem={setSelectedItem}
                  setCreatingParentId={setCreatingParentId}
                  updateWorkItem={updateWorkItem}
                  transitionWorkItem={transitionWorkItem}
                  iterations={iterations}
                  creatingParentId={creatingParentId}
                  createForm={createForm}
                  setCreateForm={setCreateForm}
                  handleSaveCreate={handleSaveCreate}
                />
              ))}
              
              {roots.length === 0 && !creatingParentId && (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <p className="text-[14px] text-[var(--text-secondary)] font-medium">Your backlog is empty.</p>
                  <p className="text-[13px] text-[var(--text-muted)] mt-1">Create a root item to get started.</p>
                </div>
              )}
            </div>
          </div>
          )}

          {isPlanningOpen && (
            <div className="w-72 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] flex flex-col overflow-hidden">
              <div className="py-3 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]">
                <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Planning</h3>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Drag items to assign iterations</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {iterationsError ? (
                  <div className="flex flex-col items-start gap-2 py-4">
                    <p className="text-[12px] text-[var(--priority-high)]">Failed to load iterations</p>
                    <span className="text-[11px] text-[var(--text-muted)]">{iterationsError.message}</span>
                    <button
                      onClick={() => refetchIterations()}
                      className="px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)] border border-[var(--border-default)] rounded-[var(--radius-button)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                ) : (
                  <>
                    {iterations.map((iteration: { id: string, name: string, startDate: string, endDate: string }) => (
                      <IterationDropZone key={iteration.id} iteration={iteration} />
                    ))}
                    <IterationDropZone iteration={{ id: 'unassigned', name: 'Backlog (Unassigned)', startDate: '', endDate: '' }} isUnassigned />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        
        {selectedItem && (
          <WorkItemDrawer 
            item={selectedItem} 
            onClose={() => setSelectedItem(null)} 
          />
        )}
      </div>
    </DndContext>
  );
}

function WorkItemRow({ 
  item, 
  depth, 
  expanded,
  setExpanded, 
  toggleExpand, 
  editingId, 
  setEditingId, 
  editForm, 
  setEditForm, 
  setSelectedItem, 
  setCreatingParentId, 
  updateWorkItem,
  transitionWorkItem, 
  iterations,
  creatingParentId,
  createForm,
  setCreateForm,
  handleSaveCreate
}: {
  item: WorkItem;
  depth: number;
    expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleExpand: (id: string) => void;
  editingId: string | null;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  editForm: Partial<WorkItem>;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<WorkItem>>>;
  setSelectedItem: React.Dispatch<React.SetStateAction<WorkItem | null>>;
  setCreatingParentId: React.Dispatch<React.SetStateAction<string | null>>;
  updateWorkItem: ReturnType<typeof useUpdateWorkItem>;
  transitionWorkItem: ReturnType<typeof useTransitionWorkItemState>;
  iterations: Iteration[];
  creatingParentId: string | null;
  createForm: { title: string; type: WorkItem['type'] };
  setCreateForm: React.Dispatch<React.SetStateAction<{ title: string; type: WorkItem['type'] }>>;
  handleSaveCreate: () => Promise<void>;
}) {
  const isExpanded = expanded.has(item.id);
  const { data: children = [] } = useWorkItemChildren(item.projectId, item.id, { enabled: isExpanded });
  const hasChildren = item.hasChildren || children.length > 0;

  const isEditing = editingId === item.id;


  const { attributes, listeners, setNodeRef: setDragNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item }
  });

  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: `item-${item.id}`,
    data: { item }
  });

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDragNodeRef(node);
    setDropNodeRef(node);
  };


  return (
    <React.Fragment>
      <div 
        ref={setNodeRef}
        className={`grid grid-cols-[auto_100px_1fr_100px_100px_100px_120px_120px_100px] gap-4 py-2 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] transition-colors items-center cursor-pointer group ${isDragging ? 'opacity-50' : ''} ${isOver ? 'bg-[var(--brand-primary)]/10' : ''}`}
        onClick={() => {
          if (!isEditing) setSelectedItem(item);
        }}
      >
        <div 
          className="flex items-center" 
          style={{ width: `${depth * 20 + 40}px`, paddingLeft: `${depth * 20}px` }}
        >
          <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing mr-1 opacity-0 group-hover:opacity-100 transition-opacity" {...listeners} {...attributes} onClick={e => e.stopPropagation()}>
            <GripVertical className="w-3 h-3" />
          </button>
          <div onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }} className="flex items-center">
            {hasChildren ? (
              <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : <span className="w-4 h-4 inline-block" />}
          </div>
        </div>
        
        <div className="text-[12px] font-medium text-[var(--text-secondary)]">{item.key}</div>
        
        <div className="text-[13px] text-[var(--text-primary)] font-medium truncate">
          {isEditing ? (
            <input 
              autoFocus
              className="border border-[var(--border-default)] px-2 py-1 rounded-[var(--radius-input)] w-full text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
              value={editForm.title || ''}
              onChange={e => setEditForm({ ...editForm, title: e.target.value })}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            item.title
          )}
        </div>

        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-button)] text-[11px] font-medium bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
            {item.type}
          </span>
        </div>

        <div>
          {isEditing ? (
            <select 
              className="border border-[var(--border-default)] px-2 py-1 rounded-[var(--radius-input)] w-full text-[12px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
              value={editForm.state || item.state}
              onChange={e => setEditForm({ ...editForm, state: e.target.value as WorkItem['state'] })}
              onClick={e => e.stopPropagation()}
            >
              <option value="New">New</option>
              <option value="Active">Active</option>
              <option value="Closed">Closed</option>
            </select>
          ) : (
            <span className="text-[12px] text-[var(--text-secondary)]">
              {item.state.replace('_', ' ')}
            </span>
          )}
        </div>

        <div>
          {isEditing ? (
            <select 
              className="border border-[var(--border-default)] px-2 py-1 rounded-[var(--radius-input)] w-full text-[12px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
              value={editForm.priority || item.priority}
              onChange={e => setEditForm({ ...editForm, priority: e.target.value as WorkItem['priority'] })}
              onClick={e => e.stopPropagation()}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${item.priority === 'HIGH' || item.priority === 'URGENT' ? 'bg-[var(--priority-high)]' : 'bg-[var(--priority-medium)]'}`}></div>
              <span className="text-[12px] text-[var(--text-secondary)]">{item.priority}</span>
            </div>
          )}
        </div>

        <div className="text-[12px] text-[var(--text-secondary)] truncate">
          {isEditing ? (
            <select 
              className="border border-[var(--border-default)] px-2 py-1 rounded-[var(--radius-input)] w-full text-[12px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
              value={editForm.assignedTo ?? ''}
              onChange={e => setEditForm({ ...editForm, assignedTo: e.target.value || null })}
              onClick={e => e.stopPropagation()}
            >
              <option value="">Unassigned</option>
              <option value="user-1">Alice Smith</option>
              <option value="user-2">Bob Jones</option>
              <option value="user-3">Charlie Brown</option>
            </select>
          ) : (
            item.assignedTo ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[9px] text-[var(--text-primary)]">
                  {item.assignedTo.substring(0,2).toUpperCase()}
                </div>
                <span className="truncate">{item.assignedTo}</span>
              </div>
            ) : 'Unassigned'
          )}
        </div>

        <div>
          {isEditing ? (
            <select 
              className="border border-[var(--border-default)] px-2 py-1 rounded-[var(--radius-input)] w-full text-[12px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
              value={editForm.iterationId ?? ''}
              onChange={e => setEditForm({ ...editForm, iterationId: e.target.value || null })}
              onClick={e => e.stopPropagation()}
            >
              <option value="">(No Iteration)</option>
              {iterations.map((s: Iteration) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          ) : (
            <span className="text-[12px] text-[var(--text-secondary)] truncate block">
              {item.iterationId ? iterations.find((s: Iteration) => s.id === item.iterationId)?.name || 'Unknown Iteration' : '-'}
            </span>
          )}
        </div>

        <div className="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
          {isEditing ? (
            <>
              <button 
                onClick={async (e) => {
                  e.stopPropagation();
                  const { state, ...rest } = editForm;
                  const promises = [];
                  if (Object.keys(rest).length > 0) {
                    promises.push(updateWorkItem.mutateAsync({ id: item.id, data: rest }));
                  }
                  if (state && state !== item.state) {
                    promises.push(transitionWorkItem.mutateAsync({ id: item.id, state }));
                  }
                  await Promise.all(promises);
                  setEditingId(null);
                }}
                className="text-[11px] px-2 py-1 bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] font-medium"
              >
                Save
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                className="text-[11px] px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] font-medium"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditForm(item); }}
                className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
              >
                Edit
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setCreatingParentId(item.id);
                  setExpanded((prev: Set<string>) => new Set(prev).add(item.id));
                }}
                className="text-[11px] text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] font-medium flex items-center"
                title="Add child"
              >
                <Plus className="w-3 h-3 mr-0.5" /> Child
              </button>
            </>
          )}
        </div>
      </div>
      
      {creatingParentId === item.id && (
        <div className="flex items-center gap-3 py-2 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-selected)]">
          <div style={{ width: `${(depth + 1) * 20 + 40}px` }} />
          <select
            className="border border-[var(--border-default)] px-2 py-1 rounded-[var(--radius-input)] text-[12px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
            value={createForm.type}
            onChange={e => setCreateForm({ ...createForm, type: e.target.value as WorkItem['type'] })}
          >
            <option value="EPIC">Epic</option>
            <option value="FEATURE">Feature</option>
            <option value="STORY">Story</option>
            <option value="TASK">Task</option>
            <option value="BUG">Bug</option>
          </select>
          <input
            autoFocus
            placeholder="Title..."
            className="border border-[var(--border-default)] px-3 py-1 rounded-[var(--radius-input)] w-64 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
            value={createForm.title}
            onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSaveCreate();
              if (e.key === 'Escape') setCreatingParentId(null);
            }}
          />
          <button onClick={handleSaveCreate} className="bg-[var(--brand-primary)] text-white px-3 py-1 rounded-[var(--radius-button)] text-[12px] font-medium">Save</button>
          <button onClick={() => setCreatingParentId(null)} className="px-3 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[12px] font-medium">Cancel</button>
        </div>
      )}

      {isExpanded && children?.map((child: WorkItem) => (
        <WorkItemRow 
          key={child.id} 
          item={child} 
          depth={depth + 1} 
                    expanded={expanded}
          setExpanded={setExpanded} 
          toggleExpand={toggleExpand}
          editingId={editingId}
          setEditingId={setEditingId}
          editForm={editForm}
          setEditForm={setEditForm}
          setSelectedItem={setSelectedItem}
          setCreatingParentId={setCreatingParentId}
          updateWorkItem={updateWorkItem}
          transitionWorkItem={transitionWorkItem}
          iterations={iterations}
          creatingParentId={creatingParentId}
          createForm={createForm}
          setCreateForm={setCreateForm}
          handleSaveCreate={handleSaveCreate}
        />
      ))}
    </React.Fragment>
  );
}

function IterationDropZone({ iteration, isUnassigned = false }: { iteration: { id: string, name: string, startDate: string, endDate: string }, isUnassigned?: boolean }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `iteration-${iteration.id}`,
    data: { iterationId: iteration.id }
  });

  return (
    <div 
      ref={setNodeRef}
      className={`p-3 border rounded-[var(--radius-card)] transition-colors ${isOver ? 'bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]' : 'bg-[var(--bg-surface)] border-[var(--border-default)]'}`}
    >
      <h4 className={`text-[13px] font-semibold ${isOver ? 'text-[var(--brand-primary)]' : 'text-[var(--text-primary)]'}`}>{iteration.name}</h4>
      {!isUnassigned && iteration.startDate && iteration.endDate && (
        <p className="text-[11px] text-[var(--text-secondary)] mt-1">
          {format(new Date(iteration.startDate), 'MMM d')} - {format(new Date(iteration.endDate), 'MMM d, yyyy')}
        </p>
      )}
    </div>
  );
}
