'use client';

import React, { useState, useMemo } from 'react';
import { useWorkItems, useUpdateWorkItem, useCreateWorkItem, WorkItem } from '@/hooks/useWorkItems';
import { useSprints } from '@/hooks/useSprints';
import { WorkItemDrawer } from '@/components/WorkItemDrawer';
import { WorkItemFilters, useWorkItemFilters } from '@/components/WorkItemFilters';

export function BacklogBoard({ projectId }: { projectId: string }) {
  const filters = useWorkItemFilters();
  const { data: workItems = [], isLoading, error } = useWorkItems(projectId, filters);
  const { data: sprints = [] } = useSprints(projectId);
  const updateWorkItem = useUpdateWorkItem(projectId);
  const createWorkItem = useCreateWorkItem(projectId);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<WorkItem>>({});
  
  const [creatingParentId, setCreatingParentId] = useState<string | 'root' | null>(null);
  const [createForm, setCreateForm] = useState<{ title: string, type: 'TASK' | 'BUG' | 'STORY' }>({ title: '', type: 'TASK' });
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { roots, childrenMap } = useMemo(() => {
    const r: WorkItem[] = [];
    const cMap: Record<string, WorkItem[]> = {};
    
    // Group all by parentId
    const itemMap = new Map<string, WorkItem>();
    workItems.forEach((item: WorkItem) => itemMap.set(item.id, item));

    workItems.forEach((item: WorkItem) => {
      if (item.parentId && itemMap.has(item.parentId)) {
        if (!cMap[item.parentId]) cMap[item.parentId] = [];
        cMap[item.parentId].push(item);
      } else {
        r.push(item);
      }
    });

    return { roots: r, childrenMap: cMap };
  }, [workItems]);

  const handleSaveEdit = () => {
    if (editingId && editForm) {
      updateWorkItem.mutate({ id: editingId, data: editForm });
    }
    setEditingId(null);
  };

  const handleSaveCreate = () => {
    if (createForm.title.trim()) {
      createWorkItem.mutate({
        ...createForm,
        parentId: creatingParentId === 'root' ? null : creatingParentId
      });
    }
    setCreatingParentId(null);
    setCreateForm({ title: '', type: 'TASK' });
  };

  const typeColors: Record<string, string> = {
    BUG: 'text-red-600 bg-red-50 dark:bg-red-950/30',
    STORY: 'text-green-600 bg-green-50 dark:bg-green-950/30',
    TASK: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading backlog...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Failed to load backlog.</div>;

  const renderRow = (item: WorkItem, depth: number) => {
    const hasChildren = childrenMap[item.id] && childrenMap[item.id].length > 0;
    const isExpanded = expanded.has(item.id);
    const isEditing = editingId === item.id;

    return (
      <React.Fragment key={item.id}>
        <div className={`grid grid-cols-[auto_100px_1fr_100px_100px_100px_120px_120px_100px] gap-4 py-2 px-4 items-center border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors`}>
          
          <div style={{ paddingLeft: `${depth * 24}px`, width: `${depth * 24 + 32}px` }} className="flex justify-end pr-2">
            {hasChildren ? (
              <button onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-black dark:hover:text-white">
                {isExpanded ? '▼' : '▶'}
              </button>
            ) : <span className="w-4" />}
          </div>

          <button 
            onClick={() => setSelectedItem(item)}
            className="font-mono text-xs text-blue-600 hover:underline text-left"
          >
            {item.key}
          </button>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <input 
                autoFocus
                className="border border-gray-300 dark:border-gray-700 px-2 py-1 rounded w-full bg-transparent"
                value={editForm.title || ''}
                onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                onBlur={handleSaveEdit}
              />
            ) : (
              <span className="font-medium cursor-pointer" onDoubleClick={() => { setEditingId(item.id); setEditForm(item); }}>
                {item.title}
              </span>
            )}
          </div>

          <div>
            {isEditing ? (
              <select 
                className="border border-gray-300 dark:border-gray-700 px-1 py-1 rounded text-xs bg-transparent"
                value={editForm.type || item.type}
                onChange={e => setEditForm({ ...editForm, type: e.target.value as WorkItem['type'] })}

              >
                <option value="STORY">Story</option>
                <option value="TASK">Task</option>
                <option value="BUG">Bug</option>
              </select>
            ) : (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${typeColors[item.type] || 'text-gray-600 bg-gray-100'}`}>
                {item.type}
              </span>
            )}
          </div>

          <div>
            {isEditing ? (
              <select 
                className="border border-gray-300 dark:border-gray-700 px-1 py-1 rounded text-xs bg-transparent"
                value={editForm.state || item.state}
                onChange={e => setEditForm({ ...editForm, state: e.target.value as WorkItem['state'] })}
              >
                <option value="TODO">Todo</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
            ) : (
              <span className="text-xs text-gray-500">{item.state.replace('_', ' ')}</span>
            )}
          </div>

          <div>
            {isEditing ? (
              <select 
                className="border border-gray-300 dark:border-gray-700 px-1 py-1 rounded text-xs bg-transparent"
                value={editForm.priority || item.priority}
                onChange={e => setEditForm({ ...editForm, priority: e.target.value as WorkItem['priority'] })}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            ) : (
              <span className={`text-xs ${item.priority === 'HIGH' || item.priority === 'URGENT' ? 'text-orange-500' : 'text-gray-500'}`}>
                {item.priority}
              </span>
            )}
          </div>

          <div className="text-xs text-gray-500 truncate">
            {item.assignedTo ? item.assignedTo.substring(0, 8) + '...' : 'Unassigned'}
          </div>

          <div>
            {isEditing ? (
              <select 
                className="border border-gray-300 dark:border-gray-700 px-1 py-1 rounded text-xs bg-transparent w-full"
                value={(editForm as any).sprintId || (item as any).sprintId || ''}
                onChange={e => setEditForm({ ...editForm, sprintId: e.target.value || null } as any)}
              >
                <option value="">(No Sprint)</option>
                {sprints.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-gray-500 truncate block">
                {(item as any).sprintId ? sprints.find((s: any) => s.id === (item as any).sprintId)?.name || 'Unknown Sprint' : '-'}
              </span>
            )}
          </div>

          <div className="flex gap-2 items-center">
            {isEditing && (
              <select
                className="border border-gray-300 dark:border-gray-700 px-1 py-1 rounded text-xs bg-transparent max-w-[80px]"
                value={editForm.parentId || ''}
                onChange={e => setEditForm({ ...editForm, parentId: e.target.value || null })}
                title="Change Parent"
              >
                <option value="">(No Parent)</option>
                {workItems.filter((i: WorkItem) => i.id !== item.id).map((i: WorkItem) => (
                  <option key={i.id} value={i.id}>{i.key}</option>
                ))}
              </select>
            )}
            <button 
              onClick={() => {
                setCreatingParentId(item.id);
                setExpanded(prev => new Set(prev).add(item.id));
              }}
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Add child"
            >
              + Child
            </button>
          </div>
        </div>
        
        {creatingParentId === item.id && (
          <div className="flex items-center gap-2 py-2 px-4 border-b border-gray-100 dark:border-gray-800 bg-blue-50 dark:bg-blue-900/10">
            <div style={{ width: `${(depth + 1) * 24 + 32}px` }} />
            <select
              className="border border-gray-300 dark:border-gray-700 px-2 py-1 rounded text-xs bg-white dark:bg-gray-950"
              value={createForm.type}
              onChange={e => setCreateForm({ ...createForm, type: e.target.value as WorkItem['type'] })}
            >
              <option value="TASK">Task</option>
              <option value="BUG">Bug</option>
              <option value="STORY">Story</option>
            </select>
            <input
              autoFocus
              placeholder="Title..."
              className="border border-gray-300 dark:border-gray-700 px-2 py-1 rounded w-64 text-sm bg-white dark:bg-gray-950"
              value={createForm.title}
              onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveCreate();
                if (e.key === 'Escape') setCreatingParentId(null);
              }}
            />
            <button onClick={handleSaveCreate} className="bg-blue-600 text-white px-3 py-1 rounded text-xs">Save</button>
            <button onClick={() => setCreatingParentId(null)} className="px-3 py-1 text-gray-500 text-xs">Cancel</button>
          </div>
        )}

        {isExpanded && childrenMap[item.id]?.map(child => renderRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Backlog</h1>
        <button 
          onClick={() => setCreatingParentId('root')}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          + New Root Item
        </button>
      </div>

      <WorkItemFilters />

      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[auto_100px_1fr_100px_100px_100px_120px_120px_100px] gap-4 py-3 px-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 font-semibold text-xs text-gray-500 uppercase tracking-wider">
          <div style={{ width: '32px' }} />
          <div>Key</div>
          <div>Title</div>
          <div>Type</div>
          <div>State</div>
          <div>Priority</div>
          <div>Assignee</div>
          <div>Sprint</div>
          <div>Actions</div>
        </div>

        {creatingParentId === 'root' && (
          <div className="flex items-center gap-2 py-3 px-4 border-b border-gray-100 dark:border-gray-800 bg-blue-50 dark:bg-blue-900/10">
            <div style={{ width: '32px' }} />
            <select
              className="border border-gray-300 dark:border-gray-700 px-2 py-1 rounded text-xs bg-white dark:bg-gray-950"
              value={createForm.type}
              onChange={e => setCreateForm({ ...createForm, type: e.target.value as WorkItem['type'] })}
            >
              <option value="STORY">Story</option>
              <option value="TASK">Task</option>
              <option value="BUG">Bug</option>
            </select>
            <input
              autoFocus
              placeholder="Title..."
              className="border border-gray-300 dark:border-gray-700 px-2 py-1 rounded w-64 text-sm bg-white dark:bg-gray-950"
              value={createForm.title}
              onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveCreate();
                if (e.key === 'Escape') setCreatingParentId(null);
              }}
            />
            <button onClick={handleSaveCreate} className="bg-blue-600 text-white px-3 py-1 rounded text-xs">Save</button>
            <button onClick={() => setCreatingParentId(null)} className="px-3 py-1 text-gray-500 text-xs">Cancel</button>
          </div>
        )}

        <div className="flex flex-col">
          {roots.map(item => renderRow(item, 0))}
          {roots.length === 0 && !creatingParentId && (
            <div className="py-8 text-center text-gray-500 text-sm">No items found. Create a root item to get started.</div>
          )}
        </div>
      </div>
      
      {selectedItem && (
        <WorkItemDrawer 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)} 
        />
      )}
    </div>
  );
}
