import {
  ANALYTICS_CATEGORY_LABELS,
  ANALYTICS_CATEGORY_ORDER,
  AnalyticsCategory,
  AnalyticsDataset,
  AnalyticsHistoryEvent,
  AnalyticsWorkItem,
  BurndownDto,
  BurndownPointDto,
  CumulativeFlowDto,
  FlowItemDurationDto,
  FlowTimeDto,
  FlowTimeStatsDto,
  VelocityDto,
  VelocityIterationDto,
  ThroughputDto,
  ThroughputPeriodDto,
  ProjectHealthDto,
  CategoryBreakdownDto,
  WorkItemAgingDto,
  AgingBucketDto,
  OverdueReportDto,
  OverdueWorkItemDto,
  WorkDistributionDto,
  DistributionGroupDto,
  StateTransitionsDto,
  StateTimeDto,
  TransitionPairDto,
  TrendsAnalyticsDto,
  TrendPointDto,
} from './dto/analytics.dto.js';

/**
 * Pure analytics calculations.
 *
 * These functions NEVER compute historical metrics from the current work-item
 * state alone. Each metric is the result of replaying the immutable
 * `work_item_history` log (state transitions, iteration moves, points
 * changes), the iteration calendar, and recorded timestamps:
 *
 *  - Sprint burndown  → replay of which items were in the sprint on each day,
 *                       their points at that time, and when they became done.
 *  - Velocity         → committed scope at each sprint start + completions
 *                       attributed via the item's iteration membership at the
 *                       done transition.
 *  - Cumulative flow  → per-day category/state distribution reconstructed from
 *                       every STATE_CHANGED transition.
 *  - Cycle time       → first entry into In Progress → done transition.
 *  - Lead time        → creation → done transition.
 *
 * The module is intentionally free of I/O / Nest imports so the math can be
 * validated against deterministic fixtures in unit tests.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORY_COLORS: Record<AnalyticsCategory, string> = {
  PROPOSED: '#9ca3af',
  IN_PROGRESS: '#3b82f6',
  RESOLVED: '#f59e0b',
  COMPLETED: '#10b981',
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function toDateLabel(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

function parsePoints(value: string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// ─── Per-item replay models ─────────────────────────────────────────────────

interface Segments {
  time: number;
  group: string;
}

interface PointSeries {
  time: number;
  points: number;
}

interface IterationSpan {
  iterationId: string | null;
  enter: number;
  exit: number | null;
}

interface ItemModel {
  item: AnalyticsWorkItem;
  categorySegments: Segments[];
  stateSegments: Segments[];
  pointSeries: PointSeries[];
  iterationSpans: IterationSpan[];
  doneTime: number | null;
  firstInProgress: number | null;
  deletedAt: number | null;
}

function sortEvents<T extends { insertedAt: Date; id?: string }>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    const t = a.insertedAt.getTime() - b.insertedAt.getTime();
    if (t !== 0) return t;
    return (a.id ?? '').localeCompare(b.id ?? '');
  });
}

function buildSegments(
  item: AnalyticsWorkItem,
  history: AnalyticsHistoryEvent[],
  groupOf: (stateKey: string) => string | null,
  seed: { group: string; time: number } | null,
): Segments[] {
  const segs: Segments[] = [];
  if (seed) segs.push({ time: seed.time, group: seed.group });

  const states: Array<{ time: number; value: string }> = history
    .filter((h) => h.action === 'STATE_CHANGED' && h.newValue)
    .map((h) => ({ time: h.insertedAt.getTime(), value: h.newValue as string }))
    .sort((a, b) => a.time - b.time || a.value.localeCompare(b.value));

  for (const s of states) {
    const group = groupOf(s.value);
    if (!group) continue;
    const last = segs[segs.length - 1];
    if (!last || last.group !== group) {
      segs.push({ time: s.time, group });
    }
  }
  if (segs.length === 0) {
    segs.push({ time: item.createdAt.getTime(), group: 'PROPOSED' });
  }
  return segs;
}

function buildPointSeries(item: AnalyticsWorkItem, history: AnalyticsHistoryEvent[]): PointSeries[] {
  const events = sortEvents(
    history.filter((h) => h.action === 'POINTS_CHANGED').map((h) => ({
      id: h.id,
      insertedAt: h.insertedAt,
      time: h.insertedAt.getTime(),
      old: parsePoints(h.oldValue),
      current: parsePoints(h.newValue),
    })),
  );

  const netDelta = events.reduce((acc, e) => acc + (e.current - e.old), 0);
  const initial = Math.max(0, (item.points ?? 0) - netDelta);

  const series: PointSeries[] = [{ time: item.createdAt.getTime(), points: initial }];
  for (const e of events) series.push({ time: e.time, points: e.current });
  return series;
}

function buildIterationSpans(item: AnalyticsWorkItem, history: AnalyticsHistoryEvent[]): IterationSpan[] {
  const iterations = sortEvents(history.filter((x) => x.action === 'ITERATION_CHANGED'));
  const enters: Array<{ time: number; toId: string | null }> = [];

  if (iterations.length === 0) {
    // No recorded moves: the current assignment is the original one.
    if (item.iterationId) enters.push({ time: item.createdAt.getTime(), toId: item.iterationId });
  } else {
    // The item has moved before — the pre-first-move assignment is the first
    // event's oldValue (null when it was created unassigned). Seeding from the
    // current iteration would falsely report it was assigned there all along.
    const first = iterations[0];
    if (first.oldValue) enters.push({ time: item.createdAt.getTime(), toId: first.oldValue });
    for (const h of iterations) {
      const toId = h.newValue ? h.newValue : null;
      const fromId = h.oldValue ? h.oldValue : null;
      if (toId !== fromId) enters.push({ time: h.insertedAt.getTime(), toId });
    }
  }

  const deletion = history.find((h) => h.action === 'DELETED');
  if (deletion) enters.push({ time: deletion.insertedAt.getTime(), toId: null });

  enters.sort((a, b) => (a.time - b.time) || (a.toId === null ? 1 : -1));

  const spans: IterationSpan[] = [];
  let current: { iterationId: string | null; enter: number } | null = null;
  for (const e of enters) {
    const mappedToId = e.toId as string | null;
    if (current && current.iterationId === mappedToId) continue;
    if (current) spans.push({ ...current, exit: e.time });
    current = { iterationId: mappedToId, enter: e.time };
  }
  if (current) spans.push({ ...current, exit: null });
  return spans;
}

function firstDoneTime(item: AnalyticsWorkItem, catSegs: Segments[]): number | null {
  if (catSegs[0]?.group === 'COMPLETED') return catSegs[0].time;
  const transition = catSegs.find((s) => s.group === 'COMPLETED');
  if (transition) return transition.time;
  if (item.completedAt) return item.completedAt.getTime();
  if (item.closedAt) return item.closedAt.getTime();
  return null;
}

function firstInProgress(catSegs: Segments[]): number | null {
  const entry = catSegs.find((s) => s.group === 'IN_PROGRESS');
  return entry ? entry.time : null;
}

function groupAt(segs: Segments[], t: number): string {
  let lo = 0;
  let hi = segs.length - 1;
  let result = segs[0]?.group ?? 'PROPOSED';
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].time <= t) {
      result = segs[mid].group;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

function pointsAt(series: PointSeries[], t: number): number {
  let lo = 0;
  let hi = series.length - 1;
  let result = series[0]?.points ?? 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].time <= t) {
      result = series[mid].points;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

function spanContainsAt(span: IterationSpan, t: number): boolean {
  return t >= span.enter && (span.exit === null || t < span.exit);
}

function buildModels(dataset: AnalyticsDataset): ItemModel[] {
  const statesByKey = new Map(dataset.states.map((s) => [s.key, s]));
  const groupOf = (stateKey: string): string | null => statesByKey.get(stateKey)?.category ?? null;
  const stateKeyGroup = (stateKey: string): string | null => stateKey || null;

  const historyByItem = new Map<string, AnalyticsHistoryEvent[]>();
  for (const h of dataset.history) {
    const list = historyByItem.get(h.workItemId) ?? [];
    list.push(h);
    historyByItem.set(h.workItemId, list);
  }

  return dataset.items.map((item) => {
    const history = historyByItem.get(item.id) ?? [];
    const defaultState =
      dataset.states.find((s) => s.isDefault) ??
      (dataset.states.length > 0 ? [...dataset.states].sort((a, b) => a.sortOrder - b.sortOrder)[0] : null);
    const seedTime = item.createdAt.getTime();
    const categorySegments = buildSegments(
      item,
      history,
      groupOf,
      { time: seedTime, group: 'PROPOSED' },
    );
    const stateSegments = buildSegments(
      item,
      history,
      stateKeyGroup,
      defaultState ? { time: seedTime, group: defaultState.key } : null,
    );
    const deletion = history.find((h) => h.action === 'DELETED');
    return {
      item,
      categorySegments,
      stateSegments,
      pointSeries: buildPointSeries(item, history),
      iterationSpans: buildIterationSpans(item, history),
      doneTime: firstDoneTime(item, categorySegments),
      firstInProgress: firstInProgress(categorySegments),
      deletedAt: deletion ? deletion.insertedAt.getTime() : null,
    };
  });
}

// ─── Sprint Burndown ────────────────────────────────────────────────────────

export function computeBurndown(dataset: AnalyticsDataset, iterationId: string): BurndownDto {
  const iteration = dataset.iterations.find((it) => it.id === iterationId);
  if (!iteration) {
    throw new Error(`Iteration ${iterationId} not found in dataset`);
  }

  const models = buildModels(dataset).filter((m) =>
    m.iterationSpans.some((s) => s.iterationId === iterationId),
  );

  const startMs = startOfUtcDay(iteration.startDate).getTime();
  const endMs = startOfUtcDay(iteration.endDate).getTime();
  const days = Math.max(1, Math.round((endMs - startMs) / DAY_MS) + 1);

  const bucketEnds: number[] = [];
  for (let i = 0; i < days; i++) bucketEnds.push(startMs + (i + 1) * DAY_MS);

  // Scope as of the sprint start instant (drives the ideal line).
  let scopePointsAtStart = 0;
  let scopeItemsAtStart = 0;
  for (const m of models) {
    const inSprint = m.iterationSpans.some((s) => s.iterationId === iterationId && spanContainsAt(s, startMs));
    if (!inSprint) continue;
    scopePointsAtStart += pointsAt(m.pointSeries, startMs);
    scopeItemsAtStart += 1;
  }

  const points: BurndownPointDto[] = [];
  for (const t of bucketEnds) {
    let remainingPoints = 0;
    let remainingItems = 0;
    let scopePoints = 0;
    let scopeItems = 0;
    let completedPoints = 0;
    let completedItems = 0;
    for (const m of models) {
      const inSprint = m.iterationSpans.some((s) => s.iterationId === iterationId && spanContainsAt(s, t));
      if (!inSprint) continue;
      const pts = pointsAt(m.pointSeries, t);
      scopePoints += pts;
      scopeItems += 1;
      if (m.doneTime !== null && m.doneTime <= t) {
        completedPoints += pts;
        completedItems += 1;
      } else {
        remainingPoints += pts;
        remainingItems += 1;
      }
    }
    const labelDate = new Date(t - DAY_MS);
    points.push({
      date: toDateLabel(labelDate),
      label: labelDate.toISOString().slice(5, 10),
      remainingPoints: round2(remainingPoints),
      remainingItems,
      scopePoints: round2(scopePoints),
      scopeItems,
      completedPoints: round2(completedPoints),
      completedItems,
    });
  }

  points.unshift({
    date: toDateLabel(startMs),
    label: startOfUtcDay(iteration.startDate).toISOString().slice(5, 10),
    remainingPoints: round2(scopePointsAtStart),
    remainingItems: scopeItemsAtStart,
    scopePoints: round2(scopePointsAtStart),
    scopeItems: scopeItemsAtStart,
    completedPoints: 0,
    completedItems: 0,
  });

  const last = points[points.length - 1];
  const ideal = points.map((p, i) => ({
    date: p.date,
    points: round2(scopePointsAtStart * (1 - i / (points.length - 1 || 1))),
  }));

  return {
    iterationId,
    iterationName: iteration.name,
    startDate: toDateLabel(startMs),
    endDate: toDateLabel(endMs),
    status: iteration.state,
    totalScopePoints: round2(scopePointsAtStart),
    totalScopeItems: scopeItemsAtStart,
    completedPoints: round2(last?.completedPoints ?? 0),
    completedItems: last?.completedItems ?? 0,
    remainingPoints: round2(last?.remainingPoints ?? 0),
    remainingItems: last?.remainingItems ?? 0,
    isComplete: (last?.remainingPoints ?? 0) <= 0,
    points: points.map((p) => ({ ...p, remainingPoints: round2(p.remainingPoints), scopePoints: round2(p.scopePoints), completedPoints: round2(p.completedPoints) })),
    ideal,
    meta: { source: 'live', computedAt: null },
  };
}

// ─── Velocity ───────────────────────────────────────────────────────────────

export function computeVelocity(
  dataset: AnalyticsDataset,
  fromMs: number,
  toMs: number,
): VelocityDto {
  const iterations = dataset.iterations
    .filter((it) => it.startDate.getTime() <= toMs && it.endDate.getTime() >= fromMs)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const models = buildModels(dataset);

  const iterationRows: VelocityIterationDto[] = iterations.map((itr) => {
    const itrStart = itr.startDate.getTime();
    let committedItems = 0;
    let committedPoints = 0;
    for (const m of models) {
      const inSprint = m.iterationSpans.some(
        (s) => s.iterationId === itr.id && spanContainsAt(s, itrStart),
      );
      if (!inSprint) continue;
      committedItems += 1;
      committedPoints += pointsAt(m.pointSeries, itrStart);
    }
    return {
      iterationId: itr.id,
      name: itr.name,
      startDate: toDateLabel(itr.startDate),
      endDate: toDateLabel(itr.endDate),
      state: itr.state,
      committedItems,
      committedPoints: round2(committedPoints),
      completedItems: 0,
      completedPoints: 0,
      completionRatio: null,
    };
  });

  const rowById = new Map(iterationRows.map((r) => [r.iterationId, r]));

  for (const m of models) {
    if (m.doneTime === null || m.doneTime < fromMs || m.doneTime > toMs) continue;
    const span = m.iterationSpans.find(
      (s) => s.iterationId !== null && s.iterationId !== undefined && spanContainsAt(s, m.doneTime as number),
    );
    if (!span || !span.iterationId) continue;
    const row = rowById.get(span.iterationId);
    if (!row) continue;
    row.completedItems += 1;
    row.completedPoints = round2(row.completedPoints + pointsAt(m.pointSeries, m.doneTime));
  }

  const rows = iterationRows.map((r) => ({
    ...r,
    completionRatio:
      r.committedPoints > 0 ? clamp01(r.completedPoints / r.committedPoints) : null,
  }));

  const totalCompletedPoints = round2(rows.reduce((acc, r) => acc + r.completedPoints, 0));
  const avgCompletedPoints =
    rows.length > 0 ? round2(totalCompletedPoints / rows.length) : 0;
  const lastIteration = rows[rows.length - 1] ?? null;

  return {
    from: toDateLabel(new Date(fromMs)),
    to: toDateLabel(new Date(toMs)),
    iterations: rows,
    summary: {
      iterations: rows.length,
      totalCommittedPoints: round2(rows.reduce((acc, r) => acc + r.committedPoints, 0)),
      totalCompletedPoints,
      avgCompletedPoints,
      lastIteration,
    },
    meta: { source: 'live', computedAt: null },
  };
}

// ─── Cumulative Flow ────────────────────────────────────────────────────────

export function computeCumulativeFlow(
  dataset: AnalyticsDataset,
  fromMs: number,
  toMs: number,
  bucketSizeDays: number,
  groupBy: 'category' | 'state',
): CumulativeFlowDto {
  const fromStart = startOfUtcDay(new Date(fromMs)).getTime();
  const toStart = startOfUtcDay(new Date(toMs)).getTime();
  const bucketStep = bucketSizeDays * DAY_MS;
  const bucketCount = Math.max(
    1,
    Math.ceil((toStart + DAY_MS - fromStart) / bucketStep),
  );

  const categories =
    groupBy === 'category'
      ? ANALYTICS_CATEGORY_ORDER.map((key) => ({
          key,
          label: ANALYTICS_CATEGORY_LABELS[key] ?? key,
          color: CATEGORY_COLORS[key as AnalyticsCategory] ?? '#6b7280',
          category: key as AnalyticsCategory,
        }))
      : dataset.states
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((s) => ({
            key: s.key,
            label: s.name,
            color: s.color,
            category: s.category,
          }));

  const models = buildModels(dataset);

  const points = Array.from({ length: bucketCount }, (_, i) => {
    const bucketStart = fromStart + i * bucketStep;
    const bucketEnd = bucketStart + bucketStep;
    const t = bucketEnd;
    const counts = new Map(categories.map((c) => [c.key, 0]));
    for (const m of models) {
      if (m.item.createdAt.getTime() > t) continue;
      if (m.deletedAt !== null && m.deletedAt <= t) continue;
      const segs = groupBy === 'category' ? m.categorySegments : m.stateSegments;
      const group = groupAt(segs, t);
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return {
      date: toDateLabel(bucketStart),
      label: new Date(bucketStart).toISOString().slice(5, 10),
      series: categories.map((c) => ({ key: c.key, label: c.label, value: counts.get(c.key) ?? 0 })),
    };
  });

  const lastPoint = points[points.length - 1];
  const totals = categories.map((c) => ({
    key: c.key,
    label: c.label,
    value: lastPoint?.series.find((s) => s.key === c.key)?.value ?? 0,
  }));

  return {
    from: toDateLabel(new Date(fromMs)),
    to: toDateLabel(new Date(toMs)),
    bucketSizeDays,
    groupBy,
    categories,
    points,
    totals,
    meta: { source: 'live', computedAt: null },
  };
}

// ─── Cycle time / Lead time ─────────────────────────────────────────────────

const DISTRIBUTION_BUCKETS: Array<{ label: string; fromDays: number | null; toDays: number | null }> = [
  { label: '<1d', fromDays: null, toDays: 1 },
  { label: '1-2d', fromDays: 1, toDays: 2 },
  { label: '2-3d', fromDays: 2, toDays: 3 },
  { label: '3-5d', fromDays: 3, toDays: 5 },
  { label: '5-7d', fromDays: 5, toDays: 7 },
  { label: '1-2w', fromDays: 7, toDays: 14 },
  { label: '2w+', fromDays: 14, toDays: null },
];

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[idx];
}

function buildFlowStats(durations: number[]): FlowTimeStatsDto {
  const sorted = [...durations].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, d) => acc + d, 0);
  const median = percentile(sorted, 50);
  const p85 = percentile(sorted, 85);
  const p95 = percentile(sorted, 95);
  const min = count > 0 ? sorted[0] : 0;
  const max = count > 0 ? sorted[sorted.length - 1] : 0;
  const days = (ms: number) => round2(ms / DAY_MS);
  const hours = (ms: number) => round2(ms / (60 * 60 * 1000));

  return {
    count,
    avgDays: count > 0 ? days(sum / count) : 0,
    medianDays: days(median),
    p85Days: days(p85),
    p95Days: days(p95),
    minDays: days(min),
    maxDays: days(max),
    avgHours: count > 0 ? hours(sum / count) : 0,
    medianHours: hours(median),
    p85Hours: hours(p85),
    p95Hours: hours(p95),
    distribution: DISTRIBUTION_BUCKETS.map((b) => ({
      label: b.label,
      fromDays: b.fromDays,
      toDays: b.toDays,
      count: sorted.filter(
        (d) =>
          (b.fromDays === null || d / DAY_MS >= b.fromDays) &&
          (b.toDays === null || d / DAY_MS < b.toDays),
      ).length,
    })),
  };
}

export interface ComputeTimeToDoneOptions {
  kind: 'cycle' | 'lead';
  fromMs: number;
  toMs: number;
  type?: string | null;
  limit?: number;
}

export function computeTimeToDone(
  dataset: AnalyticsDataset,
  opts: ComputeTimeToDoneOptions,
): FlowTimeDto {
  const models = buildModels(dataset);
  const durations: Array<{ model: ItemModel; durationMs: number; startMs: number }> = [];

  for (const m of models) {
    if (m.doneTime === null) continue;
    if (m.doneTime < opts.fromMs || m.doneTime > opts.toMs) continue;
    if (opts.type && m.item.type !== opts.type) continue;
    const startMs =
      opts.kind === 'cycle'
        ? m.firstInProgress ?? m.item.createdAt.getTime()
        : m.item.createdAt.getTime();
    const durationMs = Math.max(0, m.doneTime - startMs);
    durations.push({ model: m, durationMs, startMs });
  }

  const stats = buildFlowStats(durations.map((d) => d.durationMs));
  const sorted = [...durations].sort((a, b) => a.durationMs - b.durationMs);
  const items: FlowItemDurationDto[] = sorted
    .slice(0, opts.limit ?? 500)
    .map(({ model, durationMs, startMs }) => ({
      workItemId: model.item.id,
      key: `WI-${model.item.seqNo}`,
      title: model.item.title,
      type: model.item.type,
      points: model.item.points,
      startedAt: new Date(startMs).toISOString(),
      completedAt: new Date(model.doneTime as number).toISOString(),
      durationDays: round2(durationMs / DAY_MS),
      durationHours: round2(durationMs / (60 * 60 * 1000)),
    }));

  return {
    from: toDateLabel(new Date(opts.fromMs)),
    to: toDateLabel(new Date(opts.toMs)),
    type: opts.type ?? null,
    stats,
    items,
    meta: { source: 'live', computedAt: null },
  };
}

// ─── Summary ────────────────────────────────────────────────────────────────

export function computeSummary(
  dataset: AnalyticsDataset,
  fromMs: number,
  toMs: number,
) {
  const velocity = computeVelocity(dataset, fromMs, toMs);
  const cycle = computeTimeToDone(dataset, { kind: 'cycle', fromMs, toMs });
  const lead = computeTimeToDone(dataset, { kind: 'lead', fromMs, toMs });
  const flow = computeCumulativeFlow(dataset, fromMs, toMs, 1, 'category');

  const flowTotals = new Map(flow.totals.map((t) => [t.key, t.value]));
  const models = buildModels(dataset);
  const completedInRange = models.filter((m) => m.doneTime !== null && m.doneTime >= fromMs && m.doneTime <= toMs).length;
  const createdInRange = models.filter((m) => m.item.createdAt.getTime() >= fromMs && m.item.createdAt.getTime() <= toMs).length;

  const totalWorkItems = models.length;
  const completedItems = models.filter((m) => m.doneTime !== null && m.doneTime <= toMs).length;
  const openItems = models.filter((m) => m.doneTime === null || m.doneTime > toMs).length;
  const now = Date.now();
  const overdueItems = models.filter((m) => (m.doneTime === null || m.doneTime > now) && m.item.targetDate && m.item.targetDate.getTime() < now).length;
  const completionRate = totalWorkItems > 0 ? round2((completedItems / totalWorkItems) * 100) : 0;

  return {
    from: toDateLabel(new Date(fromMs)),
    to: toDateLabel(new Date(toMs)),
    totalWorkItems,
    openItems,
    completedItems,
    overdueItems,
    blockedItems: 0,
    completionRate,
    velocity: {
      iterations: velocity.iterations.length,
      totalCompletedPoints: velocity.summary.totalCompletedPoints,
      avgCompletedPoints: velocity.summary.avgCompletedPoints,
      lastCompletedPoints: velocity.summary.lastIteration?.completedPoints ?? 0,
    },
    cycleTime: cycle.stats,
    leadTime: lead.stats,
    flow: {
      proposed: flowTotals.get('PROPOSED') ?? 0,
      inProgress: flowTotals.get('IN_PROGRESS') ?? 0,
      resolved: flowTotals.get('RESOLVED') ?? 0,
      completed: flowTotals.get('COMPLETED') ?? 0,
    },
    completedInRange,
    createdInRange,
  };
}

// ─── Throughput ─────────────────────────────────────────────────────────────

export function computeThroughput(
  dataset: AnalyticsDataset,
  fromMs: number,
  toMs: number,
  groupBy: 'day' | 'week' | 'month' = 'week',
): ThroughputDto {
  const models = buildModels(dataset);
  const doneItems = models.filter((m) => m.doneTime !== null && m.doneTime >= fromMs && m.doneTime <= toMs);

  const periods: ThroughputPeriodDto[] = [];
  const start = startOfUtcDay(new Date(fromMs));
  const end = new Date(toMs);

  let cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    let pEnd: Date;
    if (groupBy === 'day') {
      pEnd = new Date(cur.getTime() + DAY_MS - 1);
    } else if (groupBy === 'week') {
      pEnd = new Date(cur.getTime() + 7 * DAY_MS - 1);
    } else {
      pEnd = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    }
    const pStartMs = cur.getTime();
    const pEndMs = pEnd.getTime();

    const periodDone = doneItems.filter((m) => (m.doneTime as number) >= pStartMs && (m.doneTime as number) <= pEndMs);
    const count = periodDone.length;
    const points = periodDone.reduce((acc, m) => acc + pointsAt(m.pointSeries, m.doneTime as number), 0);
    const dateLabel = toDateLabel(cur);

    periods.push({
      periodKey: dateLabel,
      label: groupBy === 'month' ? cur.toISOString().slice(0, 7) : cur.toISOString().slice(5, 10),
      startDate: dateLabel,
      endDate: toDateLabel(pEndMs),
      count,
      points: round2(points),
    });

    if (groupBy === 'day') {
      cur = new Date(cur.getTime() + DAY_MS);
    } else if (groupBy === 'week') {
      cur = new Date(cur.getTime() + 7 * DAY_MS);
    } else {
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    }
  }

  const totalCompleted = doneItems.length;
  const totalPoints = round2(doneItems.reduce((acc, m) => acc + pointsAt(m.pointSeries, m.doneTime as number), 0));
  const avgPerPeriod = periods.length > 0 ? round2(totalCompleted / periods.length) : 0;

  return {
    from: toDateLabel(new Date(fromMs)),
    to: toDateLabel(new Date(toMs)),
    groupBy,
    totalCompleted,
    totalPoints,
    avgPerPeriod,
    periods,
    meta: { source: 'live', computedAt: null },
  };
}

// ─── Project Health ─────────────────────────────────────────────────────────

export function computeProjectHealth(
  dataset: AnalyticsDataset,
  projectId: string,
): ProjectHealthDto {
  const models = buildModels(dataset);
  const now = Date.now();

  const totalWorkItems = models.length;
  let completedCount = 0;
  let inProgressCount = 0;
  let notStartedCount = 0;
  let overdueCount = 0;
  let totalPoints = 0;
  let completedPoints = 0;

  const stateCounts = new Map<string, { count: number; points: number }>();
  const typeCounts = new Map<string, { count: number; points: number }>();
  const priorityCounts = new Map<string, { count: number; points: number }>();
  const areaCounts = new Map<string, { count: number; points: number }>();
  const iterationCounts = new Map<string, { count: number; points: number }>();

  for (const m of models) {
    const pts = m.item.points ?? 0;
    totalPoints += pts;

    const cat = groupAt(m.categorySegments, now);
    if (cat === 'COMPLETED') {
      completedCount++;
      completedPoints += pts;
    } else if (cat === 'IN_PROGRESS' || cat === 'RESOLVED') {
      inProgressCount++;
    } else {
      notStartedCount++;
    }

    if (cat !== 'COMPLETED' && m.item.targetDate && m.item.targetDate.getTime() < now) {
      overdueCount++;
    }

    const st = m.item.state;
    const stPrev = stateCounts.get(st) || { count: 0, points: 0 };
    stateCounts.set(st, { count: stPrev.count + 1, points: stPrev.points + pts });

    const tp = m.item.type;
    const tpPrev = typeCounts.get(tp) || { count: 0, points: 0 };
    typeCounts.set(tp, { count: tpPrev.count + 1, points: tpPrev.points + pts });

    const pr = m.item.priority;
    const prPrev = priorityCounts.get(pr) || { count: 0, points: 0 };
    priorityCounts.set(pr, { count: prPrev.count + 1, points: prPrev.points + pts });

    const ar = m.item.areaId;
    const arPrev = areaCounts.get(ar) || { count: 0, points: 0 };
    areaCounts.set(ar, { count: arPrev.count + 1, points: arPrev.points + pts });

    const itr = m.item.iterationId || 'unassigned';
    const itrPrev = iterationCounts.get(itr) || { count: 0, points: 0 };
    iterationCounts.set(itr, { count: itrPrev.count + 1, points: itrPrev.points + pts });
  }

  const completionPercentage = totalWorkItems > 0 ? round2((completedCount / totalWorkItems) * 100) : 0;

  const toCategoryBreakdown = (map: Map<string, { count: number; points: number }>): CategoryBreakdownDto[] =>
    Array.from(map.entries()).map(([key, val]) => ({
      key,
      label: key,
      count: val.count,
      percentage: totalWorkItems > 0 ? round2((val.count / totalWorkItems) * 100) : 0,
      points: round2(val.points),
    }));

  return {
    projectId,
    totalWorkItems,
    completedCount,
    inProgressCount,
    notStartedCount,
    blockedCount: 0,
    overdueCount,
    completionPercentage,
    totalPoints: round2(totalPoints),
    completedPoints: round2(completedPoints),
    byState: toCategoryBreakdown(stateCounts),
    byType: toCategoryBreakdown(typeCounts),
    byPriority: toCategoryBreakdown(priorityCounts),
    byArea: toCategoryBreakdown(areaCounts),
    byIteration: toCategoryBreakdown(iterationCounts),
    meta: { source: 'live', computedAt: null },
  };
}

// ─── Work Item Aging ────────────────────────────────────────────────────────

const AGING_DEFINITIONS = [
  { key: '0-3', label: '0–3 days', minDays: 0, maxDays: 3 },
  { key: '4-7', label: '4–7 days', minDays: 4, maxDays: 7 },
  { key: '8-14', label: '8–14 days', minDays: 8, maxDays: 14 },
  { key: '15-30', label: '15–30 days', minDays: 15, maxDays: 30 },
  { key: '30+', label: '30+ days', minDays: 30, maxDays: null },
];

export function computeAging(
  dataset: AnalyticsDataset,
  nowMs: number = Date.now(),
): WorkItemAgingDto {
  const models = buildModels(dataset);
  const activeModels = models.filter((m) => {
    if (m.deletedAt !== null && m.deletedAt <= nowMs) return false;
    const cat = groupAt(m.categorySegments, nowMs);
    return cat !== 'COMPLETED';
  });

  const totalActiveItems = activeModels.length;
  const agesDays: number[] = activeModels.map((m) =>
    round2(Math.max(0, nowMs - m.item.createdAt.getTime()) / DAY_MS),
  );

  const sortedAges = [...agesDays].sort((a, b) => a - b);
  const sumAges = sortedAges.reduce((a, b) => a + b, 0);
  const avgAgeDays = totalActiveItems > 0 ? round2(sumAges / totalActiveItems) : 0;
  const medianAgeDays = percentile(sortedAges, 50);

  const buckets: AgingBucketDto[] = AGING_DEFINITIONS.map((def) => {
    const matching = activeModels.filter((m) => {
      const age = round2(Math.max(0, nowMs - m.item.createdAt.getTime()) / DAY_MS);
      if (def.maxDays === null) return age >= def.minDays;
      return age >= def.minDays && age <= def.maxDays;
    });

    return {
      key: def.key,
      label: def.label,
      minDays: def.minDays,
      maxDays: def.maxDays,
      count: matching.length,
      items: matching.map((m) => ({
        id: m.item.id,
        seqNo: m.item.seqNo,
        title: m.item.title,
        type: m.item.type,
        state: m.item.state,
        priority: m.item.priority,
        assignedTo: m.item.assignedTo,
        assignedToName: m.item.assignedToName,
        ageDays: round2(Math.max(0, nowMs - m.item.createdAt.getTime()) / DAY_MS),
        createdAt: m.item.createdAt.toISOString(),
      })),
    };
  });

  return {
    totalActiveItems,
    avgAgeDays,
    medianAgeDays,
    buckets,
    meta: { source: 'live', computedAt: null },
  };
}

// ─── Overdue Report ─────────────────────────────────────────────────────────

export function computeOverdue(
  dataset: AnalyticsDataset,
  nowMs: number = Date.now(),
): OverdueReportDto {
  const models = buildModels(dataset);
  const iterationsById = new Map(dataset.iterations.map((it) => [it.id, it.name]));

  const overdueItems: OverdueWorkItemDto[] = [];
  for (const m of models) {
    if (m.deletedAt !== null && m.deletedAt <= nowMs) continue;
    const cat = groupAt(m.categorySegments, nowMs);
    if (cat === 'COMPLETED') continue;

    if (m.item.targetDate && m.item.targetDate.getTime() < nowMs) {
      const daysOverdue = Math.ceil((nowMs - m.item.targetDate.getTime()) / DAY_MS);
      overdueItems.push({
        id: m.item.id,
        seqNo: m.item.seqNo,
        title: m.item.title,
        type: m.item.type,
        state: m.item.state,
        priority: m.item.priority,
        assignedTo: m.item.assignedTo,
        assignedToName: m.item.assignedToName,
        targetDate: m.item.targetDate.toISOString().slice(0, 10),
        daysOverdue,
        iterationName: m.item.iterationId ? iterationsById.get(m.item.iterationId) ?? null : null,
      });
    }
  }

  overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return {
    totalOverdue: overdueItems.length,
    items: overdueItems,
    meta: { source: 'live', computedAt: null },
  };
}

// ─── Work Distribution ──────────────────────────────────────────────────────

export function computeWorkDistribution(
  dataset: AnalyticsDataset,
): WorkDistributionDto {
  const models = buildModels(dataset);
  const totalItems = models.length;

  const countAndPoints = (keyGetter: (m: ItemModel) => string): DistributionGroupDto[] => {
    const map = new Map<string, { count: number; points: number }>();
    for (const m of models) {
      const key = keyGetter(m) || 'Unassigned';
      const pts = m.item.points ?? 0;
      const prev = map.get(key) || { count: 0, points: 0 };
      map.set(key, { count: prev.count + 1, points: prev.points + pts });
    }
    return Array.from(map.entries())
      .map(([name, val]) => ({
        name,
        count: val.count,
        percentage: totalItems > 0 ? round2((val.count / totalItems) * 100) : 0,
        points: round2(val.points),
      }))
      .sort((a, b) => b.count - a.count);
  };

  return {
    totalItems,
    byType: countAndPoints((m) => m.item.type),
    byState: countAndPoints((m) => m.item.state),
    byPriority: countAndPoints((m) => m.item.priority),
    byArea: countAndPoints((m) => m.item.areaId),
    byAssignee: countAndPoints((m) => m.item.assignedToName || m.item.assignedTo || 'Unassigned'),
    meta: { source: 'live', computedAt: null },
  };
}

// ─── State Transitions & Time in State ──────────────────────────────────────

export function computeStateTransitions(
  dataset: AnalyticsDataset,
  fromMs: number,
  toMs: number,
): StateTransitionsDto {
  const models = buildModels(dataset);

  const stateDurations = new Map<string, number[]>();
  const transitionCounts = new Map<string, number>();

  for (const m of models) {
    const segs = m.stateSegments;
    for (let i = 0; i < segs.length; i++) {
      const cur = segs[i];
      const nextTime = segs[i + 1] ? segs[i + 1].time : (m.doneTime ?? toMs);
      const durationMs = Math.max(0, nextTime - cur.time);

      const durList = stateDurations.get(cur.group) || [];
      durList.push(durationMs);
      stateDurations.set(cur.group, durList);

      if (segs[i + 1]) {
        const nextState = segs[i + 1].group;
        const pairKey = `${cur.group}->${nextState}`;
        transitionCounts.set(pairKey, (transitionCounts.get(pairKey) || 0) + 1);
      }
    }
  }

  const statesResult: StateTimeDto[] = dataset.states.map((s) => {
    const durations = stateDurations.get(s.key) || [];
    const sorted = [...durations].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const days = (ms: number) => round2(ms / DAY_MS);

    return {
      stateKey: s.key,
      stateName: s.name,
      category: s.category,
      avgDays: count > 0 ? days(sum / count) : 0,
      medianDays: days(percentile(sorted, 50)),
      p85Days: days(percentile(sorted, 85)),
      totalTransitions: count,
      isBottleneck: false,
    };
  });

  let maxAvgDays = 0;
  let bottleneckStateKey: string | null = null;
  for (const s of statesResult) {
    if (s.category === 'IN_PROGRESS' || s.category === 'PROPOSED') {
      if (s.avgDays > maxAvgDays && s.totalTransitions > 0) {
        maxAvgDays = s.avgDays;
        bottleneckStateKey = s.stateKey;
      }
    }
  }
  if (bottleneckStateKey) {
    const target = statesResult.find((s) => s.stateKey === bottleneckStateKey);
    if (target) target.isBottleneck = true;
  }

  const transitionsResult: TransitionPairDto[] = Array.from(transitionCounts.entries()).map(([pair, count]) => {
    const [fromState, toState] = pair.split('->');
    return { fromState, toState, count };
  });

  return {
    from: toDateLabel(new Date(fromMs)),
    to: toDateLabel(new Date(toMs)),
    states: statesResult,
    transitions: transitionsResult,
    meta: { source: 'live', computedAt: null },
  };
}

// ─── Trends Analytics ───────────────────────────────────────────────────────

export function computeTrends(
  dataset: AnalyticsDataset,
  fromMs: number,
  toMs: number,
  groupBy: 'day' | 'week' | 'month' = 'week',
): TrendsAnalyticsDto {
  const models = buildModels(dataset);
  const throughput = computeThroughput(dataset, fromMs, toMs, groupBy);

  const points: TrendPointDto[] = throughput.periods.map((p) => {
    const pEndMs = new Date(`${p.endDate}T23:59:59.999Z`).getTime();
    const openCount = models.filter((m) => {
      if (m.item.createdAt.getTime() > pEndMs) return false;
      if (m.deletedAt !== null && m.deletedAt <= pEndMs) return false;
      const cat = groupAt(m.categorySegments, pEndMs);
      return cat !== 'COMPLETED';
    }).length;

    const cycleTimeWindow = computeTimeToDone(dataset, {
      kind: 'cycle',
      fromMs: new Date(`${p.startDate}T00:00:00.000Z`).getTime(),
      toMs: pEndMs,
    });

    return {
      date: p.periodKey,
      label: p.label,
      completedItems: p.count,
      openItems: openCount,
      avgCycleTimeDays: cycleTimeWindow.stats.avgDays,
      throughput: p.count,
    };
  });

  return {
    from: toDateLabel(new Date(fromMs)),
    to: toDateLabel(new Date(toMs)),
    groupBy,
    points,
    meta: { source: 'live', computedAt: null },
  };
}

// ─── Default windows (used by snapshot recalculation) ───────────────────────

export function defaultWindow(range: number): { fromMs: number; toMs: number } {
  const to = new Date();
  const from = new Date(to.getTime() - range * DAY_MS);
  return { fromMs: startOfUtcDay(from).getTime(), toMs: to.getTime() };
}

export { ANALYTICS_CATEGORY_ORDER, CATEGORY_COLORS };