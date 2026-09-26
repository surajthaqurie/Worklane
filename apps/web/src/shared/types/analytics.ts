/**
 * Analytics & Reporting — shared response types (mirrors backend DTOs & frontend contracts).
 */

export type AnalyticsCategory = 'PROPOSED' | 'IN_PROGRESS' | 'RESOLVED' | 'COMPLETED';

export interface AnalyticsMeta {
  source: 'snapshot' | 'live';
  computedAt: string | null;
}

// ─── Filter Model ────────────────────────────────────────────────────────────

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  teamId?: string | null;
  iterationId?: string;
  areaId?: string;
  workItemTypes?: string[];
  states?: string[];
  priorities?: string[];
  assignedTo?: string[];
  tags?: string[];
  status?: 'active' | 'completed' | 'overdue' | 'blocked' | 'all';
  groupBy?: 'day' | 'week' | 'month' | 'category' | 'state' | 'type' | 'priority' | 'area' | 'assignee';
  rangePreset?: 'today' | 'week' | 'month' | 'quarter' | '30d' | '90d' | '180d' | 'custom';
}

// ─── Burndown ───────────────────────────────────────────────────────────────

export interface BurndownPoint {
  date: string;
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
  points: BurndownPoint[];
  ideal: Array<{ date: string; points: number }>;
  meta: AnalyticsMeta;
}

// ─── Velocity ───────────────────────────────────────────────────────────────

export interface VelocityIterationDto {
  iterationId: string;
  name: string;
  startDate: string;
  endDate: string;
  committedItems: number;
  committedPoints: number;
  completedItems: number;
  completedPoints: number;
  completionRatio: number | null;
}

export interface VelocityDto {
  from: string;
  to: string;
  iterations: VelocityIterationDto[];
  summary: {
    iterations: number;
    totalCompletedPoints: number;
    avgCompletedPoints: number;
    lastCompletedPoints: number;
    avgCommittedPoints: number;
  };
  meta: AnalyticsMeta;
}

// ─── Cumulative Flow Diagram ────────────────────────────────────────────────

export interface CumulativeFlowSeries {
  key: string;
  label: string;
  value: number;
}

export interface CumulativeFlowPoint {
  date: string;
  label: string;
  series: CumulativeFlowSeries[];
}

export interface CumulativeFlowCategory {
  key: string;
  label: string;
  color: string;
  category: AnalyticsCategory;
}

export interface CumulativeFlowDto {
  from: string;
  to: string;
  bucketSizeDays: number;
  groupBy: 'category' | 'state';
  categories: CumulativeFlowCategory[];
  points: CumulativeFlowPoint[];
  totals: Array<{ key: string; label: string; value: number }>;
  meta: AnalyticsMeta;
}

// ─── Cycle time / lead time ─────────────────────────────────────────────────

export interface WorkItemDurationDto {
  id: string;
  title: string;
  type: string;
  completedAt: string | null;
  cycleHours: number | null;
  leadHours: number | null;
}

export interface FlowTimeDistributionItem {
  label: string;
  fromDays: number | null;
  toDays: number | null;
  count: number;
}

export interface FlowTimeStats {
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
  distribution: FlowTimeDistributionItem[];
}

export interface FlowTimeDto {
  from: string;
  to: string;
  type: string | null;
  stats: FlowTimeStats;
  items: WorkItemDurationDto[];
  meta: AnalyticsMeta;
}

// ─── Throughput ─────────────────────────────────────────────────────────────

export interface ThroughputPeriodDto {
  label: string;
  periodStart: string;
  periodEnd: string;
  completedItems: number;
}

export interface ThroughputDto {
  groupBy: 'day' | 'week' | 'month';
  summary: {
    totalCompleted: number;
    avgPerWeek: number;
    avgPerMonth: number;
  };
  periods: ThroughputPeriodDto[];
  meta: AnalyticsMeta;
}

// ─── Project Health ─────────────────────────────────────────────────────────

export interface CategoryBreakdown {
  name: string;
  count: number;
  completed: number;
}

export interface ProjectHealthDto {
  projectId: string;
  progress: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    blocked: number;
    overdue: number;
    completionPercent: number;
  };
  byState: CategoryBreakdown[];
  byType: CategoryBreakdown[];
  byPriority: CategoryBreakdown[];
  byArea: CategoryBreakdown[];
  byIteration: CategoryBreakdown[];
  meta: AnalyticsMeta;
}

// ─── Team Analytics ─────────────────────────────────────────────────────────

export interface TeamMemberPerformance {
  memberId: string;
  memberName: string;
  avatarUrl: string | null;
  assignedCount: number;
  inProgressCount: number;
  completedCount: number;
  completedPoints: number;
  overdueCount: number;
}

export interface TeamAnalyticsDto {
  summary: {
    totalWork: number;
    completed: number;
    remaining: number;
    overdue: number;
    blocked: number;
  };
  byMember: TeamMemberPerformance[];
  byType: Array<{ name: string; count: number; completed: number }>;
  byPriority: Array<{ name: string; count: number; completed: number }>;
  meta: AnalyticsMeta;
}

// ─── Iteration Report ───────────────────────────────────────────────────────

export interface IterationReportItem {
  id: string;
  title: string;
  type: string;
  state: string;
  points: number;
  assignee: string;
}

export interface IterationReportDto {
  iterationId: string;
  iterationName: string;
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
  completionPercent: number;
  items: IterationReportItem[];
  meta: AnalyticsMeta;
}

// ─── Work Item Aging ────────────────────────────────────────────────────────

export interface WorkItemAgingItemDto {
  id: string;
  title: string;
  type: string;
  state: string;
  priority: string;
  assigneeName: string | null;
  ageDays: number;
  daysInCurrentState: number;
}

export interface WorkItemAgingBucketDto {
  rangeKey: string;
  label: string;
  count: number;
  description: string;
}

export interface WorkItemAgingDto {
  buckets: WorkItemAgingBucketDto[];
  items: WorkItemAgingItemDto[];
  meta: AnalyticsMeta;
}

// ─── Overdue Report ─────────────────────────────────────────────────────────

export interface OverdueWorkItemDto {
  id: string;
  title: string;
  type: string;
  priority: string;
  state: string;
  assigneeName: string | null;
  iterationName: string | null;
  dueDate: string | null;
  daysOverdue: number;
}

export interface OverdueReportDto {
  overdueCount: number;
  items: OverdueWorkItemDto[];
  meta: AnalyticsMeta;
}

// ─── Blocked Report ─────────────────────────────────────────────────────────

export interface BlockedWorkItemDto {
  id: string;
  title: string;
  type: string;
  priority: string;
  state: string;
  assigneeName: string | null;
  blockedReason: string;
  blockerItemId: string | null;
}

export interface BlockedReportDto {
  blockedCount: number;
  items: BlockedWorkItemDto[];
  meta: AnalyticsMeta;
}

// ─── Work Distribution ──────────────────────────────────────────────────────

export interface WorkDistributionItemDto {
  name: string;
  count: number;
  completed: number;
  percentage: number;
}

export interface WorkDistributionDto {
  byType: WorkDistributionItemDto[];
  byState: WorkDistributionItemDto[];
  byPriority: WorkDistributionItemDto[];
  byArea: WorkDistributionItemDto[];
  byAssignee: WorkDistributionItemDto[];
  meta: AnalyticsMeta;
}

// ─── State Transitions & Time in State ──────────────────────────────────────

export interface StateTimeMetricDto {
  stateName: string;
  category: string;
  itemCount: number;
  avgHours: number;
  medianHours: number;
  p85Hours: number;
  isBottleneck: boolean;
}

export interface StateTransitionsDto {
  states: StateTimeMetricDto[];
  meta: AnalyticsMeta;
}

// ─── Trends Analytics ───────────────────────────────────────────────────────

export interface TrendPointDto {
  date: string;
  openCount: number;
  completedCount: number;
  throughput: number;
  avgCycleHours: number;
}

export interface TrendsAnalyticsDto {
  points: TrendPointDto[];
  meta: AnalyticsMeta;
}

// ─── Saved Reports ──────────────────────────────────────────────────────────

export interface SavedReport {
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

export interface CreateSavedReportPayload {
  name: string;
  description?: string;
  reportType: string;
  filters: Record<string, unknown>;
  isShared?: boolean;
}

// ─── Org Analytics Overview ─────────────────────────────────────────────────

export interface OrgProjectSummaryDto {
  projectId: string;
  projectName: string;
  projectKey: string;
  totalItems: number;
  openItems: number;
  completedItems: number;
  overdueItems: number;
  blockedItems: number;
}

export interface OrgAnalyticsOverviewDto {
  summary: {
    totalProjects: number;
    totalItems: number;
    totalOpen: number;
    totalCompleted: number;
    totalOverdue: number;
    totalBlocked: number;
  };
  projects: OrgProjectSummaryDto[];
  meta: AnalyticsMeta;
}

// ─── Summary ────────────────────────────────────────────────────────────────

export interface AnalyticsSummaryDto {
  from: string;
  to: string;
  totalItems: number;
  openCount: number;
  completedCount: number;
  overdueCount: number;
  blockedCount: number;
  throughput: {
    totalCompleted: number;
    avgPerWeek: number;
  };
  velocity: {
    iterations: number;
    totalCompletedPoints: number;
    avgCompletedPoints: number;
    lastCompletedPoints: number;
  };
  cycleTime: FlowTimeStats;
  leadTime: FlowTimeStats;
  flow: {
    proposed: number;
    inProgress: number;
    resolved: number;
    completed: number;
  };
  completedInRange: number;
  createdInRange: number;
  meta: AnalyticsMeta;
}

// ─── Snapshots ──────────────────────────────────────────────────────────────

export interface AnalyticsSnapshotInfo {
  id: string;
  kind: string;
  scope: Record<string, unknown>;
  itemCount: number;
  computedAt: string;
  jobId: string | null;
}

export interface RecomputeDto {
  projectId: string;
  snapshotCount: number;
  jobs: string[];
  computedAt: string;
  rollupCompleted: true;
}