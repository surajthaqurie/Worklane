import { z } from 'zod';

/**
 * Worklane Phase 18 — Analytics & Reporting DTOs.
 *
 * Typed metric response contracts (camelCase, frontend-friendly) plus the zod
 * schemas used to validate query params. Every metric is computed by replaying
 * history / transitions / timestamps — never from the current work-item state
 * alone — so these DTOs are deliberately self-describing (they carry the
 * window and scope they were computed over).
 */

// ─── Workflow categories ────────────────────────────────────────────────────

export const ANALYTICS_CATEGORY_ORDER = [
  'PROPOSED',
  'IN_PROGRESS',
  'RESOLVED',
  'COMPLETED',
] as const;

export const ANALYTICS_CATEGORY_LABELS: Record<string, string> = {
  PROPOSED: 'Proposed',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  COMPLETED: 'Completed',
};

export type AnalyticsCategory = (typeof ANALYTICS_CATEGORY_ORDER)[number];

export const AnalyticsSnapshotKind = {
  VELOCITY: 'velocity',
  CUMULATIVE_FLOW: 'cumulative-flow',
  CYCLE_TIME: 'cycle-time',
  LEAD_TIME: 'lead-time',
} as const;

export type AnalyticsSnapshotKind = (typeof AnalyticsSnapshotKind)[keyof typeof AnalyticsSnapshotKind];

// ─── Query param schemas ────────────────────────────────────────────────────

const teamId = z.string().min(1).optional();

const dateRange = z
  .object({
    from: z.string().date('from must be a YYYY-MM-DD date').optional(),
    to: z.string().date('to must be a YYYY-MM-DD date').optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: 'from cannot be after to',
  });

export const burndownQuerySchema = z.object({
  iterationId: z.string().min(1).optional(),
  teamId,
});

export const velocityQuerySchema = dateRange.extend({ teamId });

export const cumulativeFlowQuerySchema = dateRange.extend({
  bucketSizeDays: z.coerce.number().int().min(1).max(14).default(1),
  groupBy: z.enum(['category', 'state']).default('category'),
  teamId,
});

export const timeToDoneQuerySchema = dateRange.extend({
  type: z.enum(['EPIC', 'FEATURE', 'STORY', 'TASK', 'BUG']).optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(500),
  teamId,
});

export const summaryQuerySchema = dateRange.extend({ teamId });

export const snapshotListQuerySchema = z.object({
  kind: z
    .enum([
      AnalyticsSnapshotKind.VELOCITY,
      AnalyticsSnapshotKind.CUMULATIVE_FLOW,
      AnalyticsSnapshotKind.CYCLE_TIME,
      AnalyticsSnapshotKind.LEAD_TIME,
    ])
    .optional(),
});

export const recomputeQuerySchema = dateRange;
export const recomputeBodySchema = z.object({ from: z.string().date().optional(), to: z.string().date().optional() }).passthrough();

export type BurndownQueryDto = z.infer<typeof burndownQuerySchema>;
export type VelocityQueryDto = z.infer<typeof velocityQuerySchema>;
export type CumulativeFlowQueryDto = z.infer<typeof cumulativeFlowQuerySchema>;
export type TimeToDoneQueryDto = z.infer<typeof timeToDoneQuerySchema>;
export type SummaryQueryDto = z.infer<typeof summaryQuerySchema>;
export type SnapshotListQueryDto = z.infer<typeof snapshotListQuerySchema>;
export type RecomputeQueryDto = z.infer<typeof recomputeBodySchema>;

// ─── Analysis input rows (repository → calculations) ────────────────────────

export interface AnalyticsStateDef {
  key: string;
  name: string;
  color: string;
  sortOrder: number;
  category: AnalyticsCategory;
  isDone: boolean;
  /** The workflow's default state (where items are created). */
  isDefault: boolean;
}

export interface AnalyticsIteration {
  id: string;
  projectId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  state: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
}

export interface AnalyticsWorkItem {
  id: string;
  projectId: string;
  seqNo: number;
  iterationId: string | null;
  areaId: string;
  type: 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
  title: string;
  state: string;
  points: number | null;
  createdAt: Date;
  completedAt: Date | null;
  closedAt: Date | null;
  deletedAt: Date | null;
}

export interface AnalyticsHistoryEvent {
  id: string;
  workItemId: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  insertedAt: Date;
}

export interface AnalyticsDataset {
  iterations: AnalyticsIteration[];
  states: AnalyticsStateDef[];
  items: AnalyticsWorkItem[];
  history: AnalyticsHistoryEvent[];
}

// ─── Metadata attached to every live/replayed result ────────────────────────

interface SnapshotMeta {
  source: 'snapshot' | 'live';
  computedAt: string | null;
}

// ─── Sprint Burndown ────────────────────────────────────────────────────────

export interface BurndownPointDto {
  /** ISO date (YYYY-MM-DD) this point describes. */
  date: string;
  /** Human label for ticks (e.g. "Sep 1"). */
  label: string;
  remainingPoints: number;
  remainingItems: number;
  scopePoints: number;
  scopeItems: number;
  completedPoints: number;
  completedItems: number;
}

export interface BurndownDto {
  iterationId: string;
  iterationName: string;
  startDate: string;
  endDate: string;
  status: string;
  totalScopePoints: number;
  totalScopeItems: number;
  completedPoints: number;
  completedItems: number;
  remainingPoints: number;
  remainingItems: number;
  isComplete: boolean;
  points: BurndownPointDto[];
  /** Ideal straight line from (start, totalScopePoints) to (end, 0). */
  ideal: Array<{ date: string; points: number }>;
  meta: SnapshotMeta;
}

// ─── Velocity ───────────────────────────────────────────────────────────────

export interface VelocityIterationDto {
  iterationId: string;
  name: string;
  startDate: string;
  endDate: string;
  state: string;
  committedItems: number;
  committedPoints: number;
  completedItems: number;
  completedPoints: number;
  /** completedPoints / committedPoints when committedPoints > 0. */
  completionRatio: number | null;
}

export interface VelocityDto {
  from: string;
  to: string;
  iterations: VelocityIterationDto[];
  summary: {
    iterations: number;
    totalCommittedPoints: number;
    totalCompletedPoints: number;
    avgCompletedPoints: number;
    lastIteration: VelocityIterationDto | null;
  };
  meta: SnapshotMeta;
}

// ─── Cumulative Flow Diagram ────────────────────────────────────────────────

export interface CumulativeFlowSeriesDto {
  key: string;
  label: string;
  value: number;
}

export interface CumulativeFlowPointDto {
  date: string;
  label: string;
  series: CumulativeFlowSeriesDto[];
}

export interface CumulativeFlowDto {
  from: string;
  to: string;
  bucketSizeDays: number;
  groupBy: 'category' | 'state';
  /** Series definition in stack order (bottom → top). */
  categories: Array<{
    key: string;
    label: string;
    color: string;
    category: AnalyticsCategory;
  }>;
  points: CumulativeFlowPointDto[];
  totals: Array<{ key: string; label: string; value: number }>;
  meta: SnapshotMeta;
}

// ─── Cycle time / lead time ─────────────────────────────────────────────────

export interface FlowItemDurationDto {
  workItemId: string;
  key: string;
  title: string;
  type: string;
  points: number | null;
  /** Cycle: first entry into In Progress. Lead: work item creation. */
  startedAt: string;
  completedAt: string;
  durationDays: number;
  durationHours: number;
}

export interface FlowTimeDistributionItemDto {
  label: string;
  fromDays: number | null;
  toDays: number | null;
  count: number;
}

export interface FlowTimeStatsDto {
  count: number;
  avgDays: number;
  medianDays: number;
  p85Days: number;
  p95Days: number;
  minDays: number;
  maxDays: number;
  avgHours: number;
  medianHours: number;
  p85Hours: number;
  p95Hours: number;
  distribution: FlowTimeDistributionItemDto[];
}

export interface FlowTimeDto {
  from: string;
  to: string;
  type: string | null;
  stats: FlowTimeStatsDto;
  items: FlowItemDurationDto[];
  meta: SnapshotMeta;
}

// ─── Summary ────────────────────────────────────────────────────────────────

export interface AnalyticsSummaryDto {
  from: string;
  to: string;
  velocity: {
    iterations: number;
    totalCompletedPoints: number;
    avgCompletedPoints: number;
    lastCompletedPoints: number;
  };
  cycleTime: FlowTimeStatsDto;
  leadTime: FlowTimeStatsDto;
  flow: {
    proposed: number;
    inProgress: number;
    resolved: number;
    completed: number;
  };
  completedInRange: number;
  createdInRange: number;
  meta: SnapshotMeta;
}

// ─── Snapshots ──────────────────────────────────────────────────────────────

export interface AnalyticsSnapshotInfoDto {
  id: string;
  kind: AnalyticsSnapshotKind;
  scope: Record<string, unknown>;
  itemCount: number;
  computedAt: string;
  jobId: string | null;
}