'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Maximize2,
  Minimize2,
  EyeOff,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { WidgetLayout } from '@/shared/types/dashboard';
import { useDashboardContext } from './DashboardContext';

export interface WidgetCardProps {
  widget: WidgetLayout;
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  headerActions?: React.ReactNode;
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

export function WidgetCard({
  widget,
  title,
  description,
  icon: Icon,
  headerActions,
  isLoading = false,
  error = null,
  isEmpty = false,
  emptyTitle = 'No data available',
  emptyDescription = 'There is no information to display for this widget.',
  emptyIcon: EmptyIcon,
  children,
}: WidgetCardProps) {
  const { onResizeWidget, onToggleWidgetVisibility, refetch } = useDashboardContext();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  // Responsive column span mapping
  const colSpanClasses =
    widget.colSpan === 3
      ? 'col-span-1 md:col-span-2 lg:col-span-3'
      : widget.colSpan === 2
        ? 'col-span-1 md:col-span-2'
        : 'col-span-1';

  // Cycle colSpan between 1, 2, and 3
  const handleCycleSize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextColSpan = widget.colSpan === 1 ? 2 : widget.colSpan === 2 ? 3 : 1;
    onResizeWidget(widget.id, nextColSpan);
  };

  const handleHide = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWidgetVisibility(widget.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs transition-shadow hover:shadow-sm ${colSpanClasses}`}
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-[var(--text-muted)] hover:text-[var(--text-primary)] active:cursor-grabbing p-0.5 rounded focus:outline-hidden"
            title="Drag to reorder"
            aria-label={`Drag to reorder ${title}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 overflow-hidden">
            <Icon className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
            <div className="flex flex-col overflow-hidden">
              <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {title}
              </h3>
              {description && (
                <p className="truncate text-[11px] text-[var(--text-muted)]">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions & Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {headerActions}

          {/* Resize Button */}
          <button
            type="button"
            onClick={handleCycleSize}
            className="inline-flex items-center gap-1 rounded-[var(--radius-button)] border border-[var(--border-subtle)] px-1.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title={`Current size: ${widget.colSpan}x (Click to cycle)`}
            aria-label={`Resize ${title} widget`}
          >
            {widget.colSpan === 3 ? (
              <>
                <Minimize2 className="h-3 w-3" />
                <span className="hidden sm:inline">3x</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3 w-3" />
                <span className="hidden sm:inline">{widget.colSpan}x</span>
              </>
            )}
          </button>

          {/* Hide / Remove Widget */}
          <button
            type="button"
            onClick={handleHide}
            className="rounded-[var(--radius-button)] p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Hide widget"
            aria-label={`Hide ${title} widget`}
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Widget Body */}
      <div className="flex-1 p-4 flex flex-col justify-center">
        {isLoading ? (
          <div className="space-y-3 py-2 animate-pulse">
            <div className="h-4 bg-[var(--bg-surface-hover)] rounded-sm w-3/4" />
            <div className="h-8 bg-[var(--bg-surface-hover)] rounded-md w-full" />
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="h-10 bg-[var(--bg-surface-hover)] rounded-md" />
              <div className="h-10 bg-[var(--bg-surface-hover)] rounded-md" />
              <div className="h-10 bg-[var(--bg-surface-hover)] rounded-md" />
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="h-8 w-8 text-rose-500 mb-2" />
            <p className="text-xs font-medium text-[var(--text-primary)] mb-1">
              Failed to load widget data
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mb-3 max-w-[200px]">
              An error occurred while fetching information for this card.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-[var(--text-muted)]">
            {EmptyIcon ? (
              <EmptyIcon className="h-7 w-7 mb-2 opacity-60" />
            ) : (
              <Icon className="h-7 w-7 mb-2 opacity-40" />
            )}
            <p className="text-xs font-medium text-[var(--text-secondary)]">{emptyTitle}</p>
            <p className="text-[11px] max-w-[220px] mt-0.5">{emptyDescription}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
