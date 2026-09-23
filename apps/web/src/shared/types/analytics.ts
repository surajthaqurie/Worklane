/**
 * Analytics & Reporting — shared response types (mirrors the API DTOs).
 *
 * Every metric is computed server-side by replaying work-item history /
 * transitions / timestamps, so these shapes are self-describing: they carry
 * the window and scope they were computed over plus a snapshot/live meta tag.
 */

export type AnalyticsCategory = 'PROPOSED' | 'IN_PROGRESS' | 'RESOLVED' | 'COMPLETED';

export type AnalyticsSnapshotKind = 'velocity' | 'cumulative-flow' | 'cycle-time' | 'lead-time';

export interface AnalyticsMeta {
  source: 'snapshot' | 'live';
  computedAt: string | null;
}

// ─── Sprint Burndown ────────────────────────────────────────────────────────

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

export interface VelocityIteration {
  iterationId: string;
  name: string;
  startDate: string;
  endDate: string;
  state: string;
  committedItems: number;
  committedPoints: number;
  completedItems: number;
  completedPoints: number;
  completionRatio: number | null;
}

export interface VelocityDto {
  from: string;
  to: string;
  iterations: VelocityIteration[];
  summary: {
    iterations: number;
    totalCommittedPoints: number;
    totalCompletedPoints: number;
    avgCompletedPoints: number;
    lastIteration: VelocityIteration | null;
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

export interface FlowItemDuration {
  workItemId: string;
  key: string;
  title: string;
  type: string;
  points: number | null;
  startedAt: string;
  completedAt: string;
  durationDays: number;
  durationHours: number;
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
  items: FlowItemDuration[];
  meta: AnalyticsMeta;
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
  kind: AnalyticsSnapshotKind;
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
  calculatedAt?: string;
  from?: string;
  to?: string;
}