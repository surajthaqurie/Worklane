'use client';

import { useMemo, useState } from 'react';
import {
  CalendarRange,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
  Link2,
  ArrowRight,
  EyeOff,
} from 'lucide-react';
import {
  DeliveryPlanTimeline as DeliveryPlanTimelineData,
  TimelineDependency,
  TimelineWorkItem,
} from '@/shared/types/delivery-plans';
import {
  GUTTER_WIDTH,
  HEADER_HEIGHT,
  ZOOM_LEVELS,
  DEFAULT_ZOOM,
  buildTimelineRows,
  computeRange,
  buildAxisCells,
  barForWorkItem,
  xForDate,
} from './timelineModel';
import { useTimelineScroll, useRowWindow } from '../hooks/useTimelineScroll';
import { DateAxis } from './DateAxis';
import { DependencyArrows } from './DependencyArrows';
import { LoadingScreen } from '@/shared/components/ui/Spinner';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { format, startOfDay } from 'date-fns';

export interface DeliveryPlanTimelineProps {
  timeline: DeliveryPlanTimelineData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  /** Currently applied server-side team filter (null = all visible teams). */
  teamId: string | null;
  onTeamFilterChange: (teamId: string | null) => void;
  /** Requests the next page of work items (bumps the loading limit). */
  onLoadMore: () => void;
  /** Called when a work item bar is clicked. */
  onSelectItem: (item: TimelineWorkItem) => void;
  /** Called when the dependency affordance on a bar is clicked. */
  onOpenDependencies: (item: TimelineWorkItem) => void;
}

function barColor(item: TimelineWorkItem): string {
  if (item.isDone) return 'bg-emerald-500/90 border-emerald-600/30 text-white';
  const today = startOfDay(new Date());
  const start = item.startDate ? startOfDay(new Date(item.startDate)) : null;
  const target = item.targetDate ? startOfDay(new Date(item.targetDate)) : null;
  if (target && target < today) return 'bg-rose-500/90 border-rose-600/30 text-white';
  if (start && start <= today && (!target || target >= today)) {
    return 'bg-amber-500/90 border-amber-600/30 text-white';
  }
  return 'bg-[var(--brand-primary)]/85 border-[var(--brand-primary)]/30 text-white';
}

export function DeliveryPlanTimeline({
  timeline,
  isLoading,
  isError,
  error,
  onRetry,
  teamId,
  onTeamFilterChange,
  onLoadMore,
  onSelectItem,
  onOpenDependencies,
}: DeliveryPlanTimelineProps) {
  const { scrollRef, scrollTop, viewportHeight, onScroll } = useTimelineScroll();

  const [zoomIndex, setZoomIndex] = useState(() => Math.max(0, ZOOM_LEVELS.indexOf(DEFAULT_ZOOM)));
  const pxPerDay = ZOOM_LEVELS[zoomIndex];
  const [groupByTeam, setGroupByTeam] = useState(true);
  const [groupByIteration, setGroupByIteration] = useState(true);

  const rows = useMemo(
    () =>
      buildTimelineRows({
        teams: timeline?.teams ?? [],
        iterations: timeline?.iterations ?? [],
        workItems: timeline?.workItems ?? [],
        groupByTeam,
        groupByIteration,
      }),
    [timeline, groupByTeam, groupByIteration],
  );

  const range = useMemo(
    () => computeRange(timeline?.iterations ?? [], timeline?.workItems ?? []),
    [timeline],
  );

  const canvasWidth = Math.max(1, range.totalDays * pxPerDay);
  const axisCells = useMemo(
    () => buildAxisCells(range, pxPerDay),
    [range, pxPerDay],
  );

  const { window, topOf, totalHeight } = useRowWindow(rows, scrollTop, viewportHeight);

  // Dependency counts per item (for the little link badges on bars).
  const depCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of timeline?.dependencies ?? []) {
      counts.set(d.sourceWorkItemId, (counts.get(d.sourceWorkItemId) ?? 0) + 1);
      counts.set(d.targetWorkItemId, (counts.get(d.targetWorkItemId) ?? 0) + 1);
    }
    return counts;
  }, [timeline]);
  const visibleDepLinks = useMemo(() => {
    const visibleItems = new Set<string>();
    for (let i = window.startIndex; i < window.endIndex; i++) {
      const r = rows[i];
      if (r.workItem) visibleItems.add(r.id);
    }
    return (timeline?.dependencies ?? []).filter(
      (d) => visibleItems.has(d.sourceWorkItemId) && visibleItems.has(d.targetWorkItemId),
    );
  }, [timeline, rows, window]);

  // ─── Loading / error / empty states ────────────────────────────────────────

  if (isLoading && !timeline) {
    return <LoadingScreen message="Loading delivery plan timeline..." />;
  }

  if (isError && !timeline) {
    return <ErrorState error={error} title="Failed to load delivery plan timeline" onRetry={onRetry} />;
  }

  if (!timeline || timeline.workItems.length === 0) {
    return (
      <EmptyState
        icon={<CalendarRange className="w-6 h-6" />}
        title="No timeline items yet"
        description={
          timeline && timeline.hiddenTeamCount > 0
            ? `You're not a member of any team on this plan (${timeline.hiddenTeamCount} team(s) hidden). Ask a plan admin to add your teams, then assign dates or iterations to work items.`
            : 'Add teams to this plan and give work items start/target dates (or an iteration) to see them here.'
        }
      />
    );
  }

  const todayStart = startOfDay(new Date());
  const todayX = xForDate(todayStart.toISOString(), range, pxPerDay);
  // Server clamps `limit` to 500 — once the cap is reached the next-page
  // button is hidden (remaining items are reachable via team filters).
  const hasMore =
    timeline.totalWorkItems > timeline.workItems.length &&
    (timeline.limit ?? 0) < 500;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            className="p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] rounded-[var(--radius-button)] disabled:opacity-40 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="min-w-[64px] text-center text-[11px] font-semibold text-[var(--text-secondary)] tabular-nums">
            {pxPerDay} px / day
          </span>
          <button
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            className="p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] rounded-[var(--radius-button)] disabled:opacity-40 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomIndex(ZOOM_LEVELS.indexOf(DEFAULT_ZOOM))}
            className="p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] rounded-[var(--radius-button)] transition-colors"
            title="Reset zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-px h-5 bg-[var(--border-subtle)]" />

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setGroupByTeam((v) => !v)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
              groupByTeam
                ? 'bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/40 text-[var(--brand-primary)]'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            By Team
          </button>
          <button
            onClick={() => setGroupByIteration((v) => !v)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
              groupByIteration
                ? 'bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/40 text-[var(--brand-primary)]'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            By Iteration
          </button>
        </div>

        <select
          value={teamId ?? ''}
          onChange={(e) => onTeamFilterChange(e.target.value || null)}
          className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2 py-1 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)]"
          title="Filter timeline to one team"
        >
          <option value="">All teams</option>
          {timeline.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Done</span>
          <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> In progress</span>
          <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-[var(--brand-primary)] inline-block" /> Planned</span>
          <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" /> Overdue</span>
          <span className="flex items-center gap-1"><i className="w-4 border-t-2 border-dashed border-[var(--text-muted)] inline-block" /> Related</span>
        </div>
      </div>

      {/* ── Info strip ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] px-1">
        <span className="flex items-center gap-1.5">
          <CalendarRange className="w-3.5 h-3.5" />
          {format(range.start, 'MMM d, yyyy')} — {format(range.end, 'MMM d, yyyy')}
          <span className="px-1.5 py-px bg-[var(--bg-surface-hover)] rounded-full">
            {timeline.teams.length} team(s) · {timeline.workItems.length} of {timeline.totalWorkItems} items
          </span>
          {timeline.hiddenTeamCount > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-px bg-[var(--bg-surface-hover)] rounded-full">
              <EyeOff className="w-3 h-3" /> {timeline.hiddenTeamCount} hidden
            </span>
          )}
        </span>
        {hasMore && (
          <button
            onClick={onLoadMore}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-[var(--brand-primary)] border border-[var(--brand-primary)]/40 rounded-full hover:bg-[var(--brand-primary)]/10 transition-colors"
          >
            <ArrowRight className="w-3 h-3" /> Load next {Math.min(300, timeline.totalWorkItems - timeline.workItems.length)} items
          </button>
        )}
      </div>

      {/* ── Scrollable timeline ─────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative overflow-auto border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] max-h-[calc(100vh-340px)] min-h-[400px]"
      >
        <div className="flex min-w-max">
          {/* Left gutter (sticky) */}
          <div className="sticky left-0 z-30 shrink-0 bg-[var(--bg-surface)] border-r border-[var(--border-strong)]">
            {/* Corner cell */}
            <div
              className="sticky top-0 z-40 flex items-center justify-between px-3 border-b border-[var(--border-strong)] bg-[var(--bg-app)]"
              style={{ width: GUTTER_WIDTH, height: HEADER_HEIGHT }}
            >
              <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Delivery Timeline
              </span>
              <Link2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </div>

            {/* Windowed gutter rows */}
            <div className="relative" style={{ height: totalHeight }}>
              {rows.slice(window.startIndex, window.endIndex).map((row, i) => {
                const index = window.startIndex + i;
                const isTeam = row.type === 'team';
                return (
                  <div
                    key={row.id}
                    className={`absolute left-0 right-0 flex items-center gap-2 px-3 border-b border-[var(--border-subtle)] ${
                      isTeam ? 'bg-[var(--bg-surface-subtle)]' : 'bg-[var(--bg-surface)]'
                    }`}
                    style={{ top: topOf(index), height: row.height, paddingLeft: 10 + row.depth * 16 }}
                  >
                    <span
                      className={`truncate ${isTeam ? 'text-xs font-semibold text-[var(--text-primary)]' : 'text-xs text-[var(--text-secondary)]'}`}
                      title={row.label}
                    >
                      {row.label}
                    </span>
                    {row.sublabel && (
                      <span className="shrink-0 text-[10px] font-mono text-[var(--text-muted)]">
                        {row.sublabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right canvas */}
          <div className="relative" style={{ width: canvasWidth }}>
            {/* Sticky date header */}
            <div
              className="sticky top-0 z-20 bg-[var(--bg-app)] border-b border-[var(--border-strong)]"
              style={{ height: HEADER_HEIGHT, width: canvasWidth }}
            >
              <DateAxis cells={axisCells} range={range} pxPerDay={pxPerDay} canvasWidth={canvasWidth} />
            </div>

            {/* Windowed rows + arrows */}
            <div className="relative" style={{ height: totalHeight }}>
              {/* Today line */}
              {todayX >= 0 && todayX <= canvasWidth && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-[var(--brand-primary)]/50 z-0 pointer-events-none"
                  style={{ left: todayX }}
                />
              )}

              <DependencyArrows
                rows={rows}
                startIndex={window.startIndex}
                endIndex={window.endIndex}
                topOf={topOf}
                range={range}
                pxPerDay={pxPerDay}
                dependencies={visibleDepLinks}
                width={canvasWidth}
                height={totalHeight}
              />

              {rows.slice(window.startIndex, window.endIndex).map((row, i) => {
                const index = window.startIndex + i;
                const isTeam = row.type === 'team';
                const isIteration = row.type === 'iteration';

                // Iteration span bar (rendered inside its row).
                let iterationBar: { left: number; width: number } | null = null;
                if (isIteration && row.iteration) {
                  const it = row.iteration;
                  const left = xForDate(it.startDate, range, pxPerDay);
                  const right = xForDate(it.endDate, range, pxPerDay);
                  iterationBar = { left, width: Math.max(right - left, pxPerDay) };
                }

                const workItem = row.workItem;
                const bar = workItem ? barForWorkItem(workItem, range, pxPerDay) : null;
                const depCount = workItem ? (depCounts.get(workItem.id) ?? 0) : 0;

                return (
                  <div
                    key={row.id}
                    className={`absolute left-0 right-0 border-b border-[var(--border-subtle)] ${
                      isTeam ? 'bg-[var(--bg-surface-subtle)]' : 'bg-[var(--bg-surface)]'
                    }`}
                    style={{ top: topOf(index), height: row.height }}
                  >
                    {isIteration && iterationBar && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-[14px] rounded-sm bg-[var(--brand-primary)]/10 border-y border-[var(--brand-primary)]/25"
                        style={{ left: iterationBar.left, width: Math.max(iterationBar.width - 2, 6) }}
                        title={`${row.iteration?.name}: ${row.iteration ? format(new Date(row.iteration.startDate), 'MMM d') + ' – ' + format(new Date(row.iteration.endDate), 'MMM d') : ''}`}
                      />
                    )}

                    {workItem && bar && (
                      <button
                        onClick={() => onSelectItem(workItem)}
                        className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 h-[20px] rounded-[6px] border text-left overflow-hidden ${barColor(workItem)}`}
                        style={{ left: bar.left, width: bar.width }}
                        title={`${workItem.key} · ${workItem.title}`}
                      >
                        <span className="truncate text-[11px] leading-none">
                          {bar.width > 110 && (
                            <span className="font-mono font-semibold opacity-90">{workItem.key} · </span>
                          )}
                          {workItem.title}
                        </span>
                        {depCount > 0 && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDependencies(workItem);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                                onOpenDependencies(workItem);
                              }
                            }}
                            className="ml-auto shrink-0 flex items-center gap-0.5 rounded bg-black/20 px-1 py-px text-[9px] font-semibold hover:bg-black/35"
                            title={`${depCount} dependency(ies)`}
                          >
                            <Link2 className="w-2.5 h-2.5" />
                            {depCount}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}

              {window.endIndex === rows.length && rows.some((r) => r.workItem) && (
                <div className="sticky bottom-0 left-0 z-10 flex items-center justify-center gap-1.5 bg-[var(--bg-surface)]/90 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] px-3 py-1">
                  <AlertTriangle className="w-3 h-3" />
                  Only visible rows are rendered — scroll to explore the rest.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { TimelineDependency };