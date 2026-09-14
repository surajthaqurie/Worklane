'use client';
import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useWorkItems, useUpdateWorkItem, WorkItem } from '@/hooks/useWorkItems';

import { useSprints, useSprintWorkItems } from '@/hooks/useSprints';
import { WorkItemDrawer } from '@/components/WorkItemDrawer';
import { WorkItemFilters, useWorkItemFilters } from '@/components/WorkItemFilters';

const COLUMNS = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
type ColumnType = typeof COLUMNS[number];

export function KanbanBoard({ projectId, sprintId }: { projectId: string; sprintId?: string }) {
  const filters = useWorkItemFilters();
  const { data: projectWorkItems = [], isLoading: isLoadingProject, error: projectError } = useWorkItems(projectId, filters);
  const { data: sprintWorkItems = [], isLoading: isLoadingSprint, error: sprintError } = useSprintWorkItems(projectId, sprintId || '', filters);
  
  const workItems = sprintId ? sprintWorkItems : projectWorkItems;
  const isLoading = sprintId ? isLoadingSprint : isLoadingProject;
  const error = sprintId ? sprintError : projectError;

  const updateWorkItem = useUpdateWorkItem(projectId);
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  
  const uniqueAssignees = useMemo(() => {
    const assignees = new Set<string>();
    workItems.forEach((item: WorkItem) => {
      if (item.assignedTo) assignees.add(item.assignedTo);
    });
    return Array.from(assignees);
  }, [workItems]);

  const itemsByColumn = useMemo(() => {
    const grouped: Record<ColumnType, WorkItem[]> = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };
    workItems.forEach((item: WorkItem) => {
      if (grouped[item.state as ColumnType]) {
        grouped[item.state as ColumnType].push(item);
      }
    });
    return grouped;
  }, [workItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeItem = workItems.find((i: WorkItem) => i.id === active.id);
    const overId = over.id;
    
    // Find what column it was dropped into
    let newColumn = activeItem?.state;
    if (COLUMNS.includes(overId as ColumnType)) {
      newColumn = overId as ColumnType;
    } else {
      const overItem = workItems.find((i: WorkItem) => i.id === overId);
      if (overItem) newColumn = overItem.state;
    }

    if (activeItem && newColumn && activeItem.state !== newColumn) {
      updateWorkItem.mutate({
        id: activeItem.id,
        data: { state: newColumn }
      });
    }
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading board...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Failed to load board.</div>;

  return (
    <div className="flex flex-col gap-6 h-full">
      <WorkItemFilters />

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-4 h-full min-h-[500px]">
          {COLUMNS.map((col) => (
            <Column key={col} id={col} title={col.replace('_', ' ')} items={itemsByColumn[col]} onCardClick={(item) => setSelectedItem(item)} />
          ))}
        </div>
        
        <DragOverlay>
          {activeId ? <WorkItemCard item={workItems.find((i: WorkItem) => i.id === activeId)} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
      
      {selectedItem && (
        <WorkItemDrawer 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)} 
        />
      )}
    </div>
  );
}

function Column({ id, title, items, onCardClick }: { id: string, title: string, items: WorkItem[], onCardClick: (item: WorkItem) => void }) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div className="flex flex-col bg-gray-50 dark:bg-gray-900/50 rounded-xl w-[300px] md:w-1/3 min-w-[300px] flex-shrink-0 border border-gray-200 dark:border-gray-800">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-sm text-gray-500 bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      
      <div ref={setNodeRef} className="p-3 flex-grow flex flex-col gap-3 min-h-[150px]">
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableWorkItemCard key={item.id} item={item} onClick={() => onCardClick(item)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function SortableWorkItemCard({ item, onClick }: { item: WorkItem, onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <WorkItemCard item={item} onClick={onClick} />
    </div>
  );
}

function WorkItemCard({ item, isOverlay, onClick }: { item: WorkItem | undefined, isOverlay?: boolean, onClick?: () => void }) {
  if (!item) return null;

  const typeColors: Record<string, string> = {
    BUG: 'text-red-600 bg-red-50 dark:bg-red-950/30',
    STORY: 'text-green-600 bg-green-50 dark:bg-green-950/30',
    TASK: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
  };

  return (
    <div 
      className={`bg-white dark:bg-gray-950 p-4 rounded-lg shadow-sm border ${isOverlay ? 'border-blue-500 shadow-md cursor-grabbing' : 'border-gray-200 dark:border-gray-800 cursor-grab hover:border-gray-300 dark:hover:border-gray-700'}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-mono text-gray-500">{item.key}</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${typeColors[item.type] || 'text-gray-600 bg-gray-100'}`}>
          {item.type}
        </span>
      </div>
      <h4 className="font-medium text-sm mb-3 line-clamp-2">{item.title}</h4>
      
      <div className="flex justify-between items-center text-xs text-gray-500 mt-auto">
        <div className="flex items-center gap-1">
          <span className={item.priority === 'HIGH' || item.priority === 'URGENT' ? 'text-orange-500' : ''}>
            {item.priority}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-lg">👤</span>
          <span className="truncate max-w-[80px]">{item.assignedTo || 'Unassigned'}</span>
        </div>
      </div>
    </div>
  );
}
