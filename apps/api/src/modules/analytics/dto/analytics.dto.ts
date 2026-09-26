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
  THROUGHPUT: 'throughput',
  PROJECT_HEALTH: 'project-health',
  TEAM_ANALYTICS: 'team-analytics',
  AGING: 'aging',
  OVERDUE: 'overdue',
  BLOCKED: 'blocked',
  WORK_DISTRIBUTION: 'work-distribution',
  STATE_TRANSITIONS: 'state-transitions',
} as const;

export type AnalyticsSnapshotKind = (typeof AnalyticsSnapshotKind)[keyof typeof AnalyticsSnapshotKind];

// ─── Query param schemas ────────────────────────────────────────────────────

const teamId = z.string().min(1).optional();

const dateRange = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
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

export const analyticsFiltersSchema = dateRange.extend({
  teamId,
  iterationId: z.string().optional(),
  areaId: z.string().optional(),
  workItemTypes: z.union([z.string(), z.array(z.string())]).optional(),
  states: z.union([z.string(), z.array(z.string())]).optional(),
  priorities: z.union([z.string(), z.array(z.string())]).optional(),
  assignedTo: z.union([z.string(), z.array(z.string())]).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  status: z.enum(['active', 'completed', 'overdue', 'blocked', 'all']).optional(),
  groupBy: z.enum(['day', 'week', 'month', 'category', 'state', 'type', 'priority', 'area', 'assignee']).optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

export const throughputQuerySchema = dateRange.extend({
  groupBy: z.enum(['day', 'week', 'month']).default('week'),
  teamId,
});

export const snapshotListQuerySchema = z.object({
  kind: z.string().optional(),
});

export const recomputeQuerySchema = dateRange;
export const recomputeBodySchema = z.object({ from: z.string().optional(), to: z.string().optional() }).passthrough();

export const createSavedReportSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  reportType: z.string().min(1),
  filters: z.record(z.string(), z.unknown()).default({}),
  isShared: z.boolean().default(true),
});

export class CreateSavedReportDto {
  name!: string;
  description?: string;
  reportType!: string;
  filters!: Record<string, unknown>;
  isShared?: boolean;
}

export type BurndownQueryDto = z.infer<typeof burndownQuerySchema>;
export type VelocityQueryDto = z.infer<typeof velocityQuerySchema>;
export type CumulativeFlowQueryDto = z.infer<typeof cumulativeFlowQuerySchema>;
export type TimeToDoneQueryDto = z.infer<typeof timeToDoneQuerySchema>;
export type SummaryQueryDto = z.infer<typeof summaryQuerySchema>;
export type AnalyticsFiltersDto = z.infer<typeof analyticsFiltersSchema>;
export type ThroughputQueryDto = z.infer<typeof throughputQuerySchema>;
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
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  points: number | null;
  assignedTo: string | null;
  assignedToName?: string | null;
  targetDate: Date | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
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

export interface SnapshotMeta {
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

// ─── Throughput ─────────────────────────────────────────────────────────────

export interface ThroughputPeriodDto {
  periodKey: string;
  label: string;
  startDate: string;
  endDate: string;
  count: number;
  points: number;
}

export interface ThroughputDto {
  from: string;
  to: string;
  groupBy: 'day' | 'week' | 'month';
  totalCompleted: number;
  totalPoints: number;
  avgPerPeriod: number;
  periods: ThroughputPeriodDto[];
  meta: SnapshotMeta;
}

// ─── Project Health ─────────────────────────────────────────────────────────

export interface CategoryBreakdownDto {
  key: string;
  label: string;
  count: number;
  percentage: number;
  points: number;
}

export interface ProjectHealthDto {
  projectId: string;
  totalWorkItems: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  blockedCount: number;
  overdueCount: number;
  completionPercentage: number;
  totalPoints: number;
  completedPoints: number;
  byState: CategoryBreakdownDto[];
  byType: CategoryBreakdownDto[];
  byPriority: CategoryBreakdownDto[];
  byArea: CategoryBreakdownDto[];
  byIteration: CategoryBreakdownDto[];
  meta: SnapshotMeta;
}

// ─── Team Analytics ─────────────────────────────────────────────────────────

export interface TeamMemberProgressDto {
  userId: string;
  name: string;
  avatarUrl: string | null;
  assignedCount: number;
  inProgressCount: number;
  doneCount: number;
  totalPoints: number;
  completedPoints: number;
  throughput: number;
}

export interface TeamAnalyticsDto {
  teamId: string | null;
  teamName: string;
  totalWork: number;
  completed: number;
  remaining: number;
  throughput: number;
  velocity: number;
  avgCycleTimeDays: number;
  overdue: number;
  blocked: number;
  members: TeamMemberProgressDto[];
  meta: SnapshotMeta;
}

// ─── Iteration Report ───────────────────────────────────────────────────────

export interface IterationReportDto {
  iterationId: string;
  iterationName: string;
  startDate: string;
  endDate: string;
  state: string;
  committedItems: number;
  committedPoints: number;
  completedItems: number;
  completedPoints: number;
  remainingItems: number;
  remainingPoints: number;
  addedAfterStartItems: number;
  addedAfterStartPoints: number;
  removedItems: number;
  removedPoints: number;
  blockedItems: number;
  overdueItems: number;
  burndown: BurndownDto | null;
  meta: SnapshotMeta;
}

// ─── Work Item Aging ────────────────────────────────────────────────────────

export interface AgingBucketDto {
  key: string;
  label: string;
  minDays: number;
  maxDays: number | null;
  count: number;
  items: Array<{
    id: string;
    seqNo: number;
    title: string;
    type: string;
    state: string;
    priority: string;
    assignedTo: string | null;
    assignedToName?: string | null;
    ageDays: number;
    createdAt: string;
  }>;
}

export interface WorkItemAgingDto {
  totalActiveItems: number;
  avgAgeDays: number;
  medianAgeDays: number;
  buckets: AgingBucketDto[];
  meta: SnapshotMeta;
}

// ─── Overdue Report ─────────────────────────────────────────────────────────

export interface OverdueWorkItemDto {
  id: string;
  seqNo: number;
  title: string;
  type: string;
  state: string;
  priority: string;
  assignedTo: string | null;
  assignedToName?: string | null;
  targetDate: string;
  daysOverdue: number;
  iterationName: string | null;
}

export interface OverdueReportDto {
  totalOverdue: number;
  items: OverdueWorkItemDto[];
  meta: SnapshotMeta;
}

// ─── Blocked Report ─────────────────────────────────────────────────────────

export interface BlockedWorkItemDto {
  id: string;
  seqNo: number;
  title: string;
  type: string;
  state: string;
  priority: string;
  assignedTo: string | null;
  assignedToName?: string | null;
  reason: string;
  blockedBy: {
    id: string;
    seqNo: number;
    title: string;
    state: string;
  } | null;
}

export interface BlockedReportDto {
  totalBlocked: number;
  items: BlockedWorkItemDto[];
  meta: SnapshotMeta;
}

// ─── Work Distribution ──────────────────────────────────────────────────────

export interface DistributionGroupDto {
  name: string;
  count: number;
  percentage: number;
  points: number;
}

export interface WorkDistributionDto {
  totalItems: number;
  byType: DistributionGroupDto[];
  byState: DistributionGroupDto[];
  byPriority: DistributionGroupDto[];
  byArea: DistributionGroupDto[];
  byAssignee: DistributionGroupDto[];
  meta: SnapshotMeta;
}

// ─── State Transitions & Time in State ──────────────────────────────────────

export interface StateTimeDto {
  stateKey: string;
  stateName: string;
  category: AnalyticsCategory;
  avgDays: number;
  medianDays: number;
  p85Days: number;
  totalTransitions: number;
  isBottleneck: boolean;
}

export interface TransitionPairDto {
  fromState: string;
  toState: string;
  count: number;
}

export interface StateTransitionsDto {
  from: string;
  to: string;
  states: StateTimeDto[];
  transitions: TransitionPairDto[];
  meta: SnapshotMeta;
}

// ─── Trends Analytics ───────────────────────────────────────────────────────

export interface TrendPointDto {
  date: string;
  label: string;
  completedItems: number;
  openItems: number;
  avgCycleTimeDays: number;
  throughput: number;
}

export interface TrendsAnalyticsDto {
  from: string;
  to: string;
  groupBy: 'day' | 'week' | 'month';
  points: TrendPointDto[];
  meta: SnapshotMeta;
}

// ─── Saved Reports ──────────────────────────────────────────────────────────

export interface SavedReportDto {
  id: string;
  projectId: string;
  createdBy: string;
  name: string;
  description: string | null;
  reportType: string;
  filters: Record<string, unknown>;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Organization Analytics Overview ────────────────────────────────────────

export interface ProjectOverviewSummaryDto {
  projectId: string;
  projectName: string;
  projectKey: string;
  totalWorkItems: number;
  completedCount: number;
  inProgressCount: number;
  overdueCount: number;
  blockedCount: number;
  completionPercentage: number;
}

export interface OrgAnalyticsOverviewDto {
  organizationId: string;
  totalProjects: number;
  totalWorkItems: number;
  completedCount: number;
  inProgressCount: number;
  overdueCount: number;
  blockedCount: number;
  avgCompletionPercentage: number;
  projects: ProjectOverviewSummaryDto[];
  meta: SnapshotMeta;
}

// ─── Summary ────────────────────────────────────────────────────────────────

export interface AnalyticsSummaryDto {
  from: string;
  to: string;
  totalWorkItems: number;
  openItems: number;
  completedItems: number;
  overdueItems: number;
  blockedItems: number;
  completionRate: number;
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
  kind: string;
  scope: Record<string, unknown>;
  itemCount: number;
  computedAt: string;
  jobId: string | null;
}