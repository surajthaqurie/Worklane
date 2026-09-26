import { Inject, Injectable, NotFoundException, Optional, forwardRef } from '@nestjs/common';
import { AnalyticsRepository, AnalyticsTeamScope } from './analytics.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { TeamsService } from '../teams/teams.service.js';
import { Permission } from '../authorization/permissions.js';
import { BackgroundJobsService } from '../background-jobs/background-jobs.service.js';
import { JobType } from '../background-jobs/dto/background-job.dto.js';
import {
  startOfUtcDay,
  computeBurndown,
  computeCumulativeFlow,
  computeTimeToDone,
  computeVelocity,
  computeSummary,
  computeThroughput,
  computeProjectHealth,
  computeAging,
  computeOverdue,
  computeWorkDistribution,
  computeStateTransitions,
  computeTrends,
} from './analytics.calculations.js';
import {
  AnalyticsSnapshotKind,
  BurndownDto,
  CumulativeFlowDto,
  FlowTimeDto,
  RecomputeQueryDto,
  VelocityDto,
  AnalyticsSummaryDto,
  AnalyticsFiltersDto,
  ProjectHealthDto,
  TeamAnalyticsDto,
  IterationReportDto,
  ThroughputDto,
  WorkItemAgingDto,
  OverdueReportDto,
  BlockedReportDto,
  WorkDistributionDto,
  StateTransitionsDto,
  TrendsAnalyticsDto,
  SavedReportDto,
  CreateSavedReportDto,
  OrgAnalyticsOverviewDto,
} from './dto/analytics.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

type AnyMetric<T> = T & { meta?: { source: 'snapshot' | 'live'; computedAt: string | null } };

/**
 * Analytics service — permission-gated analytics request surface.
 *
 * Every public method asserts the caller has access to the project
 * (PROJECT_VIEW). Authorization is enforced strictly on the backend.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly repo: AnalyticsRepository,
    private readonly authz: AuthorizationService,
    private readonly teamsService: TeamsService,
    @Optional()
    @Inject(forwardRef(() => BackgroundJobsService))
    private readonly backgroundJobs?: BackgroundJobsService,
  ) {}

  // ─── Project Reports ──────────────────────────────────────────────────────

  async getBurndown(
    userId: string,
    projectId: string,
    query: { iterationId?: string; teamId?: string },
  ): Promise<BurndownDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);

    const iterationId = query.iterationId;
    if (!iterationId) {
      throw new NotFoundException('iterationId is required for the burndown chart');
    }

    const dataset = await this.repo.loadIterationDataset(projectId, iterationId, teamScope);
    if (dataset.iterations.find((it) => it.id === iterationId) === undefined) {
      throw new NotFoundException('Iteration not found');
    }
    if (teamScope && !teamScope.iterationIds.includes(iterationId)) {
      throw new NotFoundException('Iteration not found');
    }

    return computeBurndown(dataset, iterationId);
  }

  async getVelocity(
    userId: string,
    projectId: string,
    query: { from?: string; to?: string; teamId?: string },
  ): Promise<VelocityDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const { fromMs, toMs } = this.resolveWindow(query.from, query.to, 180);
    const scope = { from: dateOf(fromMs), to: dateOf(toMs), ...(query.teamId ? { teamId: query.teamId } : {}) };
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);

    return this.serve<VelocityDto>(
      projectId,
      AnalyticsSnapshotKind.VELOCITY,
      scope,
      async () =>
        computeVelocity(
          await this.repo.loadRangeDataset(projectId, { from: new Date(fromMs), to: new Date(toMs), teamScope }),
          fromMs,
          toMs,
        ),
    );
  }

  async getCumulativeFlow(
    userId: string,
    projectId: string,
    query: { from?: string; to?: string; bucketSizeDays?: number; groupBy?: 'category' | 'state'; teamId?: string },
  ): Promise<CumulativeFlowDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const { fromMs, toMs } = this.resolveWindow(query.from, query.to, 90);
    const bucketSizeDays = query.bucketSizeDays ?? 1;
    const groupBy = query.groupBy === 'state' ? 'state' : 'category';
    const scope = {
      from: dateOf(fromMs),
      to: dateOf(toMs),
      bucketSizeDays: String(bucketSizeDays),
      groupBy,
      ...(query.teamId ? { teamId: query.teamId } : {}),
    };
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);

    return this.serve<CumulativeFlowDto>(
      projectId,
      AnalyticsSnapshotKind.CUMULATIVE_FLOW,
      scope,
      async () =>
        computeCumulativeFlow(
          await this.repo.loadRangeDataset(projectId, { from: new Date(fromMs), to: new Date(toMs), teamScope }),
          fromMs,
          toMs,
          bucketSizeDays,
          groupBy,
        ),
    );
  }

  async getCycleTime(
    userId: string,
    projectId: string,
    query: { from?: string; to?: string; type?: string; limit?: number; teamId?: string },
  ): Promise<FlowTimeDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const { fromMs, toMs } = this.resolveWindow(query.from, query.to, 90);
    const scope = { from: dateOf(fromMs), to: dateOf(toMs), type: query.type ?? 'all', ...(query.teamId ? { teamId: query.teamId } : {}) };
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);

    return this.serve<FlowTimeDto>(
      projectId,
      AnalyticsSnapshotKind.CYCLE_TIME,
      scope,
      async () =>
        computeTimeToDone(
          await this.repo.loadRangeDataset(projectId, { from: new Date(fromMs), to: new Date(toMs), type: query.type, teamScope }),
          {
            kind: 'cycle',
            fromMs,
            toMs,
            type: query.type,
            limit: query.limit,
          },
        ),
    );
  }

  async getLeadTime(
    userId: string,
    projectId: string,
    query: { from?: string; to?: string; type?: string; limit?: number; teamId?: string },
  ): Promise<FlowTimeDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const { fromMs, toMs } = this.resolveWindow(query.from, query.to, 90);
    const scope = { from: dateOf(fromMs), to: dateOf(toMs), type: query.type ?? 'all', ...(query.teamId ? { teamId: query.teamId } : {}) };
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);

    return this.serve<FlowTimeDto>(
      projectId,
      AnalyticsSnapshotKind.LEAD_TIME,
      scope,
      async () =>
        computeTimeToDone(
          await this.repo.loadRangeDataset(projectId, { from: new Date(fromMs), to: new Date(toMs), type: query.type, teamScope }),
          {
            kind: 'lead',
            fromMs,
            toMs,
            type: query.type,
            limit: query.limit,
          },
        ),
    );
  }

  async getSummary(
    userId: string,
    projectId: string,
    query: AnalyticsFiltersDto,
  ): Promise<AnalyticsSummaryDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const { fromMs, toMs } = this.resolveWindow(query.from, query.to, 90);
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);

    const dataset = await this.repo.loadRangeDataset(projectId, {
      from: new Date(fromMs),
      to: new Date(toMs),
      types: parseArray(query.workItemTypes),
      states: parseArray(query.states),
      priorities: parseArray(query.priorities),
      assignedTo: parseArray(query.assignedTo),
      areaId: query.areaId,
      iterationId: query.iterationId,
      teamScope,
    });

    const summary = computeSummary(dataset, fromMs, toMs);
    const blocked = await this.repo.loadBlockedItems(projectId, 10);
    summary.blockedItems = blocked.length;

    return { ...summary, meta: { source: 'live', computedAt: null } };
  }

  async getThroughput(
    userId: string,
    projectId: string,
    query: { from?: string; to?: string; groupBy?: 'day' | 'week' | 'month'; teamId?: string },
  ): Promise<ThroughputDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const { fromMs, toMs } = this.resolveWindow(query.from, query.to, 90);
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);
    const groupBy = query.groupBy ?? 'week';

    const dataset = await this.repo.loadRangeDataset(projectId, {
      from: new Date(fromMs),
      to: new Date(toMs),
      teamScope,
    });

    return computeThroughput(dataset, fromMs, toMs, groupBy);
  }

  async getProjectHealth(
    userId: string,
    projectId: string,
    query: AnalyticsFiltersDto,
  ): Promise<ProjectHealthDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const { fromMs, toMs } = this.resolveWindow(query.from, query.to, 365);
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);

    const dataset = await this.repo.loadRangeDataset(projectId, {
      from: new Date(fromMs),
      to: new Date(toMs),
      types: parseArray(query.workItemTypes),
      states: parseArray(query.states),
      priorities: parseArray(query.priorities),
      assignedTo: parseArray(query.assignedTo),
      areaId: query.areaId,
      iterationId: query.iterationId,
      teamScope,
    });

    const health = computeProjectHealth(dataset, projectId);
    const blocked = await this.repo.loadBlockedItems(projectId, 100);
    health.blockedCount = blocked.length;

    return health;
  }

  async getTeamAnalytics(
    userId: string,
    projectId: string,
    query: { teamId?: string; from?: string; to?: string },
  ): Promise<TeamAnalyticsDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const { fromMs, toMs } = this.resolveWindow(query.from, query.to, 90);
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);

    const dataset = await this.repo.loadRangeDataset(projectId, {
      from: new Date(fromMs),
      to: new Date(toMs),
      teamScope,
    });

    const health = computeProjectHealth(dataset, projectId);
    const velocity = computeVelocity(dataset, fromMs, toMs);
    const cycle = computeTimeToDone(dataset, { kind: 'cycle', fromMs, toMs });

    let teamName = 'Project Scope';
    if (query.teamId) {
      try {
        const team = await this.teamsService.findOne(userId, projectId, query.teamId);
        if (team) teamName = team.name;
      } catch {
        teamName = 'Team Scope';
      }
    }

    const blocked = await this.repo.loadBlockedItems(projectId, 100);

    return {
      teamId: query.teamId || null,
      teamName,
      totalWork: health.totalWorkItems,
      completed: health.completedCount,
      remaining: health.totalWorkItems - health.completedCount,
      throughput: health.completedCount,
      velocity: velocity.summary.avgCompletedPoints,
      avgCycleTimeDays: cycle.stats.avgDays,
      overdue: health.overdueCount,
      blocked: blocked.length,
      members: [],
      meta: { source: 'live', computedAt: null },
    };
  }

  async getIterationReport(
    userId: string,
    projectId: string,
    query: { iterationId: string; teamId?: string },
  ): Promise<IterationReportDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);

    const iteration = await this.repo.loadIteration(projectId, query.iterationId);
    if (!iteration) throw new NotFoundException('Iteration not found');

    const dataset = await this.repo.loadIterationDataset(projectId, query.iterationId, teamScope);
    const burndown = computeBurndown(dataset, query.iterationId);
    const blocked = await this.repo.loadBlockedItems(projectId, 100);

    return {
      iterationId: iteration.id,
      iterationName: iteration.name,
      startDate: burndown.startDate,
      endDate: burndown.endDate,
      state: iteration.state,
      committedItems: burndown.totalScopeItems,
      committedPoints: burndown.totalScopePoints,
      completedItems: burndown.completedItems,
      completedPoints: burndown.completedPoints,
      remainingItems: burndown.remainingItems,
      remainingPoints: burndown.remainingPoints,
      addedAfterStartItems: Math.max(0, burndown.points[burndown.points.length - 1]?.scopeItems - burndown.totalScopeItems),
      addedAfterStartPoints: Math.max(0, burndown.points[burndown.points.length - 1]?.scopePoints - burndown.totalScopePoints),
      removedItems: 0,
      removedPoints: 0,
      blockedItems: blocked.length,
      overdueItems: burndown.remainingItems > 0 && new Date(iteration.endDate).getTime() < Date.now() ? burndown.remainingItems : 0,
      burndown,
      meta: { source: 'live', computedAt: null },
    };
  }

  async getAging(
    userId: string,
    projectId: string,
    query: AnalyticsFiltersDto,
  ): Promise<WorkItemAgingDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const { fromMs, toMs } = this.resolveWindow(query.from, query.to, 365);
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);

    const dataset = await this.repo.loadRangeDataset(projectId, {
      from: new Date(fromMs),
      to: new Date(toMs),
      types: parseArray(query.workItemTypes),
      states: parseArray(query.states),
      priorities: parseArray(query.priorities),
      assignedTo: parseArray(query.assignedTo),
      areaId: query.areaId,
      iterationId: query.iterationId,
      teamScope,
    });

    return computeAging(dataset, Date.now());
  }

  async getOverdue(
    userId: string,
    projectId: string,
    query: AnalyticsFiltersDto,
  ): Promise<OverdueReportDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const { fromMs, toMs } = this.resolveWindow(query.from, query.to, 365);
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);

    const dataset = await this.repo.loadRangeDataset(projectId, {
      from: new Date(fromMs),
      to: new Date(toMs),
      types: parseArray(query.workItemTypes),
      states: parseArray(query.states),
      priorities: parseArray(query.priorities),
      assignedTo: parseArray(query.assignedTo),
      areaId: query.areaId,
      iterationId: query.iterationId,
      teamScope,
    });

    return computeOverdue(dataset, Date.now());
  }

  async getBlocked(
    userId: string,
    projectId: string,
    _query: AnalyticsFiltersDto,
  ): Promise<BlockedReportDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const items = await this.repo.loadBlockedItems(projectId, 100);

    return {
      totalBlocked: items.length,
      items,
      meta: { source: 'live', computedAt: null },
    };
  }

  async getWorkDistribution(
    userId: string,
    projectId: string,
    query: AnalyticsFiltersDto,
  ): Promise<WorkDistributionDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const { fromMs, toMs } = this.resolveWindow(query.from, query.to, 365);
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);

    const dataset = await this.repo.loadRangeDataset(projectId, {
      from: new Date(fromMs),
      to: new Date(toMs),
      types: parseArray(query.workItemTypes),
      states: parseArray(query.states),
      priorities: parseArray(query.priorities),
      assignedTo: parseArray(query.assignedTo),
      areaId: query.areaId,
      iterationId: query.iterationId,
      teamScope,
    });

    return computeWorkDistribution(dataset);
  }

  async getStateTransitions(
    userId: string,
    projectId: string,
    query: AnalyticsFiltersDto,
  ): Promise<StateTransitionsDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const { fromMs, toMs } = this.resolveWindow(query.from, query.to, 90);
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);

    const dataset = await this.repo.loadRangeDataset(projectId, {
      from: new Date(fromMs),
      to: new Date(toMs),
      teamScope,
    });

    return computeStateTransitions(dataset, fromMs, toMs);
  }

  async getTrends(
    userId: string,
    projectId: string,
    query: AnalyticsFiltersDto,
  ): Promise<TrendsAnalyticsDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const { fromMs, toMs } = this.resolveWindow(query.from, query.to, 90);
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);
    const groupBy = (query.groupBy as 'day' | 'week' | 'month') || 'week';

    const dataset = await this.repo.loadRangeDataset(projectId, {
      from: new Date(fromMs),
      to: new Date(toMs),
      teamScope,
    });

    return computeTrends(dataset, fromMs, toMs, groupBy);
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  async exportCsv(
    userId: string,
    projectId: string,
    query: AnalyticsFiltersDto & { reportType?: string },
  ): Promise<{ filename: string; content: string; contentType: string }> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const { fromMs, toMs } = this.resolveWindow(query.from, query.to, 90);
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);

    const dataset = await this.repo.loadRangeDataset(projectId, {
      from: new Date(fromMs),
      to: new Date(toMs),
      types: parseArray(query.workItemTypes),
      states: parseArray(query.states),
      priorities: parseArray(query.priorities),
      assignedTo: parseArray(query.assignedTo),
      areaId: query.areaId,
      iterationId: query.iterationId,
      teamScope,
    });

    const reportType = query.reportType || 'work-items';
    let filename = `worklane-export-${reportType}-${dateOf(Date.now())}.csv`;
    const headers = ['ID', 'SeqNo', 'Title', 'Type', 'State', 'Priority', 'Points', 'Assignee', 'Created At', 'Completed At'];
    const rows = dataset.items.map((i) => [
      i.id,
      `WI-${i.seqNo}`,
      `"${(i.title || '').replace(/"/g, '""')}"`,
      i.type,
      i.state,
      i.priority,
      i.points ?? '',
      `"${(i.assignedToName || i.assignedTo || 'Unassigned').replace(/"/g, '""')}"`,
      i.createdAt.toISOString(),
      i.completedAt ? i.completedAt.toISOString() : '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    return {
      filename,
      content: csvContent,
      contentType: 'text/csv',
    };
  }

  // ─── Saved Reports ────────────────────────────────────────────────────────

  async listSavedReports(userId: string, projectId: string): Promise<SavedReportDto[]> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    return this.repo.listSavedReports(projectId);
  }

  async createSavedReport(
    userId: string,
    projectId: string,
    dto: CreateSavedReportDto,
  ): Promise<SavedReportDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    return this.repo.createSavedReport(projectId, userId, dto);
  }

  async deleteSavedReport(
    userId: string,
    projectId: string,
    reportId: string,
  ): Promise<{ success: boolean }> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    await this.repo.deleteSavedReport(projectId, reportId);
    return { success: true };
  }

  // ─── Organization Overview ────────────────────────────────────────────────

  async getOrgOverview(userId: string, orgId: string): Promise<OrgAnalyticsOverviewDto> {
    await this.authz.requireOrgMember(orgId, userId);
    const projects = await this.repo.loadOrgProjects(orgId, userId);

    let totalWorkItems = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    let overdueCount = 0;
    let blockedCount = 0;

    const projectSummaries = await Promise.all(
      projects.map(async (p) => {
        try {
          const dataset = await this.repo.loadRangeDataset(p.id, {
            from: new Date(Date.now() - 365 * DAY_MS),
            to: new Date(),
          });
          const health = computeProjectHealth(dataset, p.id);
          const blocked = await this.repo.loadBlockedItems(p.id, 50);

          totalWorkItems += health.totalWorkItems;
          completedCount += health.completedCount;
          inProgressCount += health.inProgressCount;
          overdueCount += health.overdueCount;
          blockedCount += blocked.length;

          return {
            projectId: p.id,
            projectName: p.name,
            projectKey: p.key,
            totalWorkItems: health.totalWorkItems,
            completedCount: health.completedCount,
            inProgressCount: health.inProgressCount,
            overdueCount: health.overdueCount,
            blockedCount: blocked.length,
            completionPercentage: health.completionPercentage,
          };
        } catch {
          return {
            projectId: p.id,
            projectName: p.name,
            projectKey: p.key,
            totalWorkItems: 0,
            completedCount: 0,
            inProgressCount: 0,
            overdueCount: 0,
            blockedCount: 0,
            completionPercentage: 0,
          };
        }
      }),
    );

    const avgCompletionPercentage =
      projectSummaries.length > 0
        ? Math.round(
            projectSummaries.reduce((a, b) => a + b.completionPercentage, 0) / projectSummaries.length,
          )
        : 0;

    return {
      organizationId: orgId,
      totalProjects: projects.length,
      totalWorkItems,
      completedCount,
      inProgressCount,
      overdueCount,
      blockedCount,
      avgCompletionPercentage,
      projects: projectSummaries,
      meta: { source: 'live', computedAt: null },
    };
  }

  // ─── Snapshots ────────────────────────────────────────────────────────────

  async listSnapshots(userId: string, projectId: string, kind?: AnalyticsSnapshotKind) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    return this.repo.listSnapshots(projectId, kind);
  }

  async recalculate(userId: string, projectId: string, body: RecomputeQueryDto) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    if (this.backgroundJobs) {
      await this.backgroundJobs
        .dispatchJob({
          jobType: JobType.ANALYTICS_CALCULATION,
          payload: {
            projectId,
            from: body.from,
            to: body.to,
          },
          maxRetries: 2,
        })
        .catch(() => {});
    }
    return this.recalculateProject(projectId, {
      from: body.from ? new Date(body.from) : undefined,
      to: body.to ? new Date(body.to) : undefined,
    });
  }

  async recalculateProject(
    projectId: string,
    opts: { from?: Date; to?: Date; jobId?: string | null; onProgress?: (p: number) => Promise<void> } = {},
  ) {
    const report = async (p: number) => {
      if (opts.onProgress) await opts.onProgress(Math.max(0, Math.min(100, p)));
    };

    const toMs = (opts.to ?? new Date()).getTime();
    const velocityFrom = startOfUtcDay(new Date((opts.from ?? new Date(Date.now() - 180 * DAY_MS)))).getTime();
    const rangeFrom = startOfUtcDay(new Date((opts.from ?? new Date(Date.now() - 90 * DAY_MS)))).getTime();

    const snapshots: Array<{
      kind: AnalyticsSnapshotKind;
      scope: Record<string, unknown>;
      data: Record<string, unknown>;
      itemCount: number;
    }> = [];

    const velocityDataset = await this.repo.loadRangeDataset(projectId, {
      from: new Date(velocityFrom),
      to: new Date(toMs),
    });
    const velocity = computeVelocity(velocityDataset, velocityFrom, toMs);
    snapshots.push({
      kind: AnalyticsSnapshotKind.VELOCITY,
      scope: { from: velocity.from, to: velocity.to },
      data: velocity as unknown as Record<string, unknown>,
      itemCount: velocityDataset.items.length,
    });
    await report(15);

    const flowDataset = await this.repo.loadRangeDataset(projectId, {
      from: new Date(rangeFrom),
      to: new Date(toMs),
    });
    const cumulativeFlow = computeCumulativeFlow(flowDataset, rangeFrom, toMs, 1, 'category');
    snapshots.push({
      kind: AnalyticsSnapshotKind.CUMULATIVE_FLOW,
      scope: { from: cumulativeFlow.from, to: cumulativeFlow.to, bucketSizeDays: '1', groupBy: 'category' },
      data: cumulativeFlow as unknown as Record<string, unknown>,
      itemCount: flowDataset.items.length,
    });
    await report(35);

    const cycleTime = computeTimeToDone(flowDataset, { kind: 'cycle', fromMs: rangeFrom, toMs });
    snapshots.push({
      kind: AnalyticsSnapshotKind.CYCLE_TIME,
      scope: { from: cycleTime.from, to: cycleTime.to, type: 'all' },
      data: cycleTime as unknown as Record<string, unknown>,
      itemCount: flowDataset.items.length,
    });
    await report(55);

    const leadTime = computeTimeToDone(flowDataset, { kind: 'lead', fromMs: rangeFrom, toMs });
    snapshots.push({
      kind: AnalyticsSnapshotKind.LEAD_TIME,
      scope: { from: leadTime.from, to: leadTime.to, type: 'all' },
      data: leadTime as unknown as Record<string, unknown>,
      itemCount: flowDataset.items.length,
    });
    await report(75);

    for (const snap of snapshots) {
      await this.repo.upsertSnapshot(
        projectId,
        snap.kind,
        snap.scope,
        snap.data,
        snap.itemCount,
        opts.jobId ?? null,
      );
    }
    await report(100);

    return {
      projectId,
      snapshotCount: snapshots.length,
      jobs: snapshots.map((s) => s.kind),
      computedAt: new Date().toISOString(),
      rollupCompleted: true,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private resolveTeamScope(
    userId: string,
    projectId: string,
    teamId: string | undefined,
  ): Promise<AnalyticsTeamScope | null> {
    if (!teamId || teamId === 'default' || teamId === 'undefined') return Promise.resolve(null);
    return this.teamsService
      .assertTeamMember(projectId, teamId, userId)
      .then(() => this.teamsService.getTeamScope(projectId, teamId))
      .then((scope) => ({ areaIds: scope.areaIds, iterationIds: scope.iterationIds }));
  }

  private resolveWindow(
    from: string | undefined,
    to: string | undefined,
    defaultDays: number,
  ): { fromMs: number; toMs: number } {
    const toMs = to ? new Date(`${to}T23:59:59.999Z`).getTime() : Date.now();
    const fromMs = from
      ? startOfUtcDay(new Date(`${from}T00:00:00.000Z`)).getTime()
      : startOfUtcDay(new Date(Date.now() - defaultDays * DAY_MS)).getTime();
    return { fromMs, toMs };
  }

  private async serve<T>(
    projectId: string,
    kind: AnalyticsSnapshotKind,
    scope: Record<string, unknown>,
    compute: () => Promise<AnyMetric<T>>,
  ): Promise<AnyMetric<T>> {
    const snapshot = await this.repo.getSnapshot(projectId, kind, scope);
    if (snapshot && Date.now() - new Date(snapshot.computedAt).getTime() <= SNAPSHOT_MAX_AGE_MS) {
      return {
        ...(snapshot.data as T),
        meta: { source: 'snapshot', computedAt: snapshot.computedAt },
      } as AnyMetric<T>;
    }
    return compute();
  }
}

function dateOf(ms: number): string {
  return startOfUtcDay(new Date(ms)).toISOString().slice(0, 10);
}

function parseArray(val: string | string[] | undefined): string[] | undefined {
  if (!val) return undefined;
  if (Array.isArray(val)) return val;
  return val.split(',').map((s) => s.trim()).filter(Boolean);
}