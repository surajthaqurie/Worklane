/**
 * Timeline data model for the Delivery Plan timeline (Phase 17).
 *
 * Converts the API's `DeliveryPlanTimeline` into a flattened, ordered list of
 * rows (team / iteration / work item) and provides the date-math helpers used
 * to position bars and arrows on the horizontal canvas:
 *
 *   canvasWidth = totalDays * pxPerDay
 *   xForDate(d) = (diffDays(d, range.start)) * pxPerDay
 *
 * Everything here is pure and deterministic so it can be memoized cheaply.
 */

import {
  TimelineIteration,
  TimelineTeam,
  TimelineWorkItem,
} from '@/shared/types/delivery-plans';
import {
  startOfDay,
  differenceInCalendarDays,
  addDays,
  startOfWeek,
  isSameMonth,
  format,
} from 'date-fns';

// ─── Layout constants ────────────────────────────────────────────────────────

export const GUTTER_WIDTH = 250;
export const HEADER_HEIGHT = 56;
export const TEAM_ROW_HEIGHT = 36;
export const ITERATION_ROW_HEIGHT = 28;
export const ITEM_ROW_HEIGHT = 30;

export const ROW_GAP = 2; // px between item rows inside a group

export const ZOOM_LEVELS = [6, 10, 16, 24, 40, 64] as const;
export const DEFAULT_ZOOM: (typeof ZOOM_LEVELS)[number] = 16;

// ─── Row model ───────────────────────────────────────────────────────────────

export type TimelineRowType = 'team' | 'iteration' | 'item';

export interface TimelineRow {
  type: TimelineRowType;
  /** Unique row key (row type + id). */
  id: string;
  /** Gutter label. */
  label: string;
  /** Secondary gutter label (usually the work item key). */
  sublabel?: string;
  depth: number;
  height: number;
  workItem?: TimelineWorkItem;
  iteration?: TimelineIteration;
}

interface BuildRowsInput {
  teams: TimelineTeam[];
  iterations: TimelineIteration[];
  workItems: TimelineWorkItem[];
  groupByTeam: boolean;
  groupByIteration: boolean;
}

/**
 * Assigns each work item to the first team whose scopes contain it
 * (iteration scope takes precedence, then area scope).
 */
export function assignItemsToTeams(
  teams: TimelineTeam[],
  workItems: TimelineWorkItem[],
): Map<string, TimelineWorkItem[]> {
  const buckets = new Map<string, TimelineWorkItem[]>();
  for (const item of workItems) {
    const team =
      teams.find(
        (t) =>
          (item.iterationId != null && t.iterationIds.includes(item.iterationId)) ||
          t.areaIds.includes(item.areaId),
      ) ?? teams[0]; // fallback — backend scoping should prevent this
    const list = buckets.get(team?.id) ?? [];
    list.push(item);
    buckets.set(team?.id, list);
  }
  return buckets;
}

function sortByDates(items: TimelineWorkItem[]) {
  return [...items].sort((a, b) => {
    const aStart = a.startDate ? Date.parse(a.startDate) : Number.POSITIVE_INFINITY;
    const bStart = b.startDate ? Date.parse(b.startDate) : Number.POSITIVE_INFINITY;
    if (aStart !== bStart) return aStart - bStart;
    return a.backlogRank - b.backlogRank || a.seqNo - b.seqNo;
  });
}

function iterationRow(it: TimelineIteration, depth: number): TimelineRow {
  return {
    type: 'iteration',
    id: it.id,
    label: it.name,
    depth,
    height: ITERATION_ROW_HEIGHT,
    iteration: it,
  };
}

/** Pseudo-group for work items with no iteration. */
function unscheduledRow(depth: number): TimelineRow {
  return {
    type: 'iteration',
    id: '__unscheduled__',
    label: 'Unscheduled',
    depth,
    height: ITERATION_ROW_HEIGHT,
  };
}

function itemRow(item: TimelineWorkItem, depth: number): TimelineRow {
  return {
    type: 'item',
    id: item.id,
    label: item.title,
    sublabel: item.key,
    depth,
    height: ITEM_ROW_HEIGHT,
    workItem: item,
  };
}

export function buildTimelineRows(input: BuildRowsInput): TimelineRow[] {
  const { teams, iterations, workItems, groupByTeam, groupByIteration } = input;
  const rows: TimelineRow[] = [];

  if (groupByTeam) {
    const buckets = assignItemsToTeams(teams, workItems);

    for (const team of teams) {
      rows.push({
        type: 'team',
        id: team.id,
        label: team.name,
        depth: 0,
        height: TEAM_ROW_HEIGHT,
      });

      const teamItems = sortByDates(buckets.get(team.id) ?? []);
      if (groupByIteration) {
        const teamIterations = iterations.filter((i) =>
          team.iterationIds.includes(i.id),
        );
        const scheduled = new Set(
          teamIterations.flatMap((i) => i.id),
        );
        for (const it of teamIterations) {
          rows.push(iterationRow(it, 1));
          for (const item of teamItems.filter((w) => w.iterationId === it.id)) {
            rows.push(itemRow(item, 2));
          }
        }
        const unscheduled = teamItems.filter(
          (w) => w.iterationId == null || !scheduled.has(w.iterationId),
        );
        if (unscheduled.length > 0) {
          rows.push(unscheduledRow(1));
          for (const item of unscheduled) rows.push(itemRow(item, 2));
        }
      } else {
        // Team-only grouping: flatten items directly under the team.
        for (const item of teamItems) rows.push(itemRow(item, 1));
      }
    }
  } else if (groupByIteration) {
    const grouped = new Map<string, TimelineWorkItem[]>();
    const unscheduled: TimelineWorkItem[] = [];
    for (const item of workItems) {
      if (item.iterationId) {
        const list = grouped.get(item.iterationId) ?? [];
        list.push(item);
        grouped.set(item.iterationId, list);
      } else {
        unscheduled.push(item);
      }
    }
    for (const it of iterations) {
      rows.push(iterationRow(it, 0));
      for (const item of sortByDates(grouped.get(it.id) ?? [])) {
        rows.push(itemRow(item, 1));
      }
    }
    if (unscheduled.length > 0) {
      rows.push(unscheduledRow(0));
      for (const item of sortByDates(unscheduled)) rows.push(itemRow(item, 1));
    }
  } else {
    // Flat list of all work items.
    for (const item of sortByDates(workItems)) rows.push(itemRow(item, 0));
  }

  return rows;
}

// ─── Range / dates ───────────────────────────────────────────────────────────

export interface TimelineRange {
  start: Date;
  end: Date;
  totalDays: number;
  startMs: number;
}

export function computeRange(
  iterations: TimelineIteration[],
  workItems: TimelineWorkItem[],
): TimelineRange {
  const dates: number[] = [];
  for (const it of iterations) {
    dates.push(Date.parse(it.startDate), Date.parse(it.endDate));
  }
  for (const w of workItems) {
    if (w.startDate) dates.push(Date.parse(w.startDate));
    if (w.targetDate) dates.push(Date.parse(w.targetDate));
  }
  const now = Date.now();
  dates.push(now);
  if (dates.length === 0) {
    const today = startOfDay(new Date());
    return {
      start: today,
      end: addDays(today, 28),
      totalDays: 29,
      startMs: today.getTime(),
    };
  }

  const min = Math.min(...dates);
  const max = Math.max(...dates);
  let start = startOfDay(new Date(min));
  let end = startOfDay(new Date(max));
  // Pad a couple of days each side so bars never hug the edges.
  start = addDays(start, -3);
  end = addDays(end, 3);
  const rawDays = differenceInCalendarDays(end, start);
  if (rawDays < 27) end = addDays(start, 27);
  return {
    start,
    end,
    totalDays: differenceInCalendarDays(end, start),
    startMs: start.getTime(),
  };
}

export function xForDate(date: string, range: TimelineRange, pxPerDay: number): number {
  const d = startOfDay(new Date(date));
  return differenceInCalendarDays(d, range.start) * pxPerDay;
}

export function barForWorkItem(
  item: TimelineWorkItem,
  range: TimelineRange,
  pxPerDay: number,
): { left: number; width: number } {
  const fallback = item.targetDate ?? range.start.toISOString();
  const startMs = item.startDate ? new Date(item.startDate) : new Date(fallback);
  const endMs = item.targetDate
    ? new Date(item.targetDate)
    : new Date(startMs.getTime() + 86400000);
  let left = differenceInCalendarDays(startOfDay(startMs), range.start) * pxPerDay;
  let right = differenceInCalendarDays(startOfDay(endMs), range.start) * pxPerDay;
  if (right <= left) right = left + pxPerDay;
  // Clamp to canvas.
  const maxX = range.totalDays * pxPerDay;
  left = Math.min(Math.max(left, 0), maxX + pxPerDay);
  right = Math.min(Math.max(right, left + pxPerDay), maxX + pxPerDay);
  return { left, width: Math.max(right - left, pxPerDay) };
}

// ─── Axis cells ──────────────────────────────────────────────────────────────

export interface AxisCell {
  key: string;
  /** x offset in canvas px. */
  left: number;
  width: number;
  label: string;
  /** Marks the first day of each month. */
  isMonthStart: boolean;
  monthLabel?: string;
}

export function buildAxisCells(
  range: TimelineRange,
  pxPerDay: number,
): AxisCell[] {
  const cells: AxisCell[] = [];
  if (pxPerDay >= 24) {
    // One cell per day.
    let day = range.start;
    for (let i = 0; i <= range.totalDays; i++) {
      const monthStart = i === 0 || isSameMonth(day, addDays(day, -1)) === false;
      cells.push({
        key: `d${i}`,
        left: i * pxPerDay,
        width: pxPerDay,
        label: format(day, 'd'),
        isMonthStart: monthStart,
        monthLabel: monthStart ? format(day, 'MMM') : undefined,
      });
      day = addDays(day, 1);
    }
  } else if (pxPerDay >= 10) {
    // One cell per week (weeks start on Monday).
    const weekStart = startOfWeek(range.start, { weekStartsOn: 1 });
    const firstWeekDelta = differenceInCalendarDays(weekStart, range.start);
    const count = Math.ceil((range.totalDays + firstWeekDelta) / 7) + 1;
    for (let i = 0; i < count; i++) {
      const ws = addDays(weekStart, i * 7);
      const left = Math.max(0, differenceInCalendarDays(ws, range.start)) * pxPerDay;
      cells.push({
        key: `w${i}`,
        left,
        width: 7 * pxPerDay,
        label: format(ws, 'MMM d'),
        isMonthStart: isSameMonth(ws, addDays(ws, -7)) === false,
        monthLabel: isSameMonth(ws, addDays(ws, -7)) === false
          ? format(ws, 'MMM')
          : undefined,
      });
    }
  } else {
    // One cell per month.
    let cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    let safety = 0;
    while (cursor.getTime() <= range.end.getTime() && safety < 60) {
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const left = Math.max(0, differenceInCalendarDays(cursor, range.start)) * pxPerDay;
      const right = differenceInCalendarDays(next, range.start) * pxPerDay;
      cells.push({
        key: `m${cursor.getFullYear()}-${cursor.getMonth()}`,
        left,
        width: Math.max(right - left, pxPerDay),
        label: format(cursor, 'MMM yy'),
        isMonthStart: true,
        monthLabel: format(cursor, 'MMM'),
      });
      cursor = next;
      safety += 1;
    }
  }
  return cells;
}

// ─── Row window (virtualization) ─────────────────────────────────────────────

export function rowOffsets(rows: TimelineRow[]): number[] {
  const offsets: number[] = new Array(rows.length);
  let acc = 0;
  for (let i = 0; i < rows.length; i++) {
    offsets[i] = acc;
    acc += rows[i].height;
  }
  return offsets;
}

export interface RowWindow {
  startIndex: number;
  endIndex: number; // exclusive
  totalHeight: number;
}

/**
 * Binary search over the prefix offsets to find the first row intersecting
 * the viewport, then walks forward collecting the visible window (+overscan).
 */
export function computeRowWindow(
  offsets: number[],
  totalHeight: number,
  scrollTop: number,
  viewportHeight: number,
  overscan = 6,
): RowWindow {
  const count = offsets.length;
  if (count === 0) return { startIndex: 0, endIndex: 0, totalHeight: 0 };

  // find first offset > scrollTop
  let lo = 0;
  let hi = count;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] <= scrollTop) lo = mid + 1;
    else hi = mid;
  }
  const startIndex = Math.max(0, lo - 1 - overscan);
  const viewBottom = scrollTop + viewportHeight;
  let endIndex = startIndex;
  while (endIndex < count && offsets[endIndex] < viewBottom) endIndex += 1;
  endIndex = Math.min(count, endIndex + overscan);
  return { startIndex, endIndex, totalHeight };
}