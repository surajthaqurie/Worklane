'use client';

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  SlidersHorizontal,
  RefreshCw,
  LayoutGrid,
  Plus,
} from 'lucide-react';
import type { WidgetLayout } from '@/shared/types/dashboard';
import {
  useDashboardData,
  useDashboardLayout,
  useResetDashboardLayout,
  useUpdateDashboardLayout,
} from '../hooks/useDashboard';
import { getWidgetDefinition, WIDGET_REGISTRY } from '../registry';
import { DashboardProvider } from './DashboardContext';
import { CustomizeDashboardModal } from './CustomizeDashboardModal';

export interface DashboardGridProps {
  projectId?: string | null;
  teamId?: string | null;
  onOpenWorkItem?: (id: string) => void;
  title?: string;
  description?: string;
}

export function DashboardGrid({
  projectId,
  teamId,
  onOpenWorkItem,
  title,
  description,
}: DashboardGridProps) {
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Layout query and mutations
  const { data: layoutData, isLoading: isLayoutLoading } = useDashboardLayout(projectId);
  const updateLayoutMutation = useUpdateDashboardLayout(projectId);
  const resetLayoutMutation = useResetDashboardLayout(projectId);

  // Batched dashboard data query
  const {
    data: dashboardData,
    isLoading: isDataLoading,
    error: dataError,
    refetch,
    isFetching,
  } = useDashboardData(projectId, teamId);

  // Setup sensors for smooth drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const rawWidgets: WidgetLayout[] = layoutData?.widgets || [];

  // Ensure all registry widgets exist in the layout model
  const allRegistryTypes = Object.keys(WIDGET_REGISTRY) as Array<keyof typeof WIDGET_REGISTRY>;
  const existingTypes = new Set(rawWidgets.map((w) => w.type));

  const completeWidgets: WidgetLayout[] = [...rawWidgets];
  let nextPos = rawWidgets.length;
  for (const regType of allRegistryTypes) {
    if (!existingTypes.has(regType)) {
      const def = WIDGET_REGISTRY[regType];
      completeWidgets.push({
        id: `widget-${regType.toLowerCase().replace(/_/g, '-')}`,
        type: regType,
        position: nextPos++,
        colSpan: def.defaultColSpan,
        rowSpan: 1,
        visible: false, // newly registered defaults start hidden if not in custom layout
      });
    }
  }

  // Sort widgets by position
  const sortedWidgets = [...completeWidgets].sort((a, b) => a.position - b.position);
  const visibleWidgets = sortedWidgets.filter((w) => w.visible);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = visibleWidgets.findIndex((item) => item.id === active.id);
    const newIndex = visibleWidgets.findIndex((item) => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedVisible = arrayMove(visibleWidgets, oldIndex, newIndex);
      // Reassign sequential positions to visible widgets
      const newLayout: WidgetLayout[] = sortedWidgets.map((w) => {
        const visIdx = reorderedVisible.findIndex((v) => v.id === w.id);
        if (visIdx !== -1) {
          return { ...w, position: visIdx };
        }
        return { ...w, position: reorderedVisible.length + w.position };
      });

      updateLayoutMutation.mutate(newLayout);
    }
  };

  const handleResizeWidget = (widgetId: string, colSpan: number) => {
    const newLayout = sortedWidgets.map((w) =>
      w.id === widgetId ? { ...w, colSpan } : w,
    );
    updateLayoutMutation.mutate(newLayout);
  };

  const handleToggleWidgetVisibility = (widgetId: string) => {
    const newLayout = sortedWidgets.map((w) =>
      w.id === widgetId ? { ...w, visible: !w.visible } : w,
    );
    updateLayoutMutation.mutate(newLayout);
  };

  const handleResetLayout = () => {
    resetLayoutMutation.mutate();
  };

  const contextValue = {
    data: dashboardData,
    isLoading: isDataLoading || isLayoutLoading,
    error: dataError,
    refetch,
    projectId,
    teamId,
    layout: sortedWidgets,
    onOpenWorkItem,
    onResizeWidget: handleResizeWidget,
    onToggleWidgetVisibility: handleToggleWidgetVisibility,
    onResetLayout: handleResetLayout,
    isCustomizing,
    setIsCustomizing,
  };

  return (
    <DashboardProvider value={contextValue}>
      <div className="w-full flex flex-col space-y-6">
        {/* Dashboard Toolbar Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div>
            {title ? (
              <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                {title}
              </h2>
            ) : (
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-[var(--brand-primary)]" />
                <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                  Dashboard
                </h2>
              </div>
            )}
            {description && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Single Cached Refresh Trigger */}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh dashboard metrics"
              aria-label="Refresh dashboard data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Customize Dashboard Button */}
            <button
              type="button"
              onClick={() => setIsCustomizing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer shadow-xs"
              aria-label="Customize dashboard widgets"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              <span>Customize Widgets</span>
            </button>
          </div>
        </div>

        {/* Responsive Grid Layout with Drag and Drop */}
        {visibleWidgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <LayoutGrid className="h-10 w-10 text-[var(--text-muted)] mb-3 opacity-50" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              No widgets are currently visible
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mb-4">
              Your dashboard layout has all widgets hidden. Customize your dashboard to display sprint metrics, activity, burndown, and more.
            </p>
            <button
              type="button"
              onClick={() => setIsCustomizing(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--brand-primary)] text-white text-xs font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Widgets
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleWidgets.map((w) => w.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                {visibleWidgets.map((widget) => {
                  const def = getWidgetDefinition(widget.type);
                  if (!def) return null;
                  const WidgetComponent = def.component;
                  return (
                    <WidgetComponent key={widget.id} widget={widget} />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Customize Modal */}
        <CustomizeDashboardModal
          isOpen={isCustomizing}
          onClose={() => setIsCustomizing(false)}
        />
      </div>
    </DashboardProvider>
  );
}
