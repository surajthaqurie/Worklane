import { Inject, Injectable, NotFoundException, Optional, forwardRef } from '@nestjs/common';
import { AnalyticsRepository, AnalyticsTeamScope } from './analytics.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { TeamsService } from '../teams/teams.service.js';
import { Permission } from '../authorization/permissions.js';
import { BackgroundJobsService } from '../background-jobs/background-jobs.service.js';
import { JobType } from '../background-jobs/dto/background-job.dto.js';
import { startOfUtcDay, computeBurndown, computeCumulativeFlow, computeTimeToDone, computeVelocity, computeSummary } from './analytics.calculations.js';
import {
  AnalyticsSnapshotKind,
  BurndownDto,
  CumulativeFlowDto,
  FlowTimeDto,
  RecomputeQueryDto,
  VelocityDto,
  AnalyticsSummaryDto,
} from './dto/analytics.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

type AnyMetric<T> = T & { meta?: { source: 'snapshot' | 'live'; computedAt: string | null } };

/**
 * Analytics service — permission-gated analytics request surface.
 *
 * Every public method starts by asserting the caller is a project member
 * (PROJECT_VIEW). Team-scoped requests additionally assert team membership and
 * narrow the dataset to the team's areas + iterations. The heavy computation
 * is delegated to the pure replay engine in `analytics.calculations`.
 *
 * A background `ANALYTICS_CALCULATION` job can precompute snapshots; read
 * endpoints serve those snapshots when the scope matches and they are fresh.
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

  // ─── Requests ─────────────────────────────────────────────────────────────

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
        computeVelocity(await this.repo.loadRangeDataset(projectId, { from: new Date(fromMs), to: new Date(toMs), teamScope }), fromMs, toMs),
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
        computeCumulativeFlow(await this.repo.loadRangeDataset(projectId, { from: new Date(fromMs), to: new Date(toMs), teamScope }), fromMs, toMs, bucketSizeDays, groupBy),
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
        computeTimeToDone(await this.repo.loadRangeDataset(projectId, { from: new Date(fromMs), to: new Date(toMs), type: query.type, teamScope }), {
          kind: 'cycle',
          fromMs,
          toMs,
          type: query.type,
          limit: query.limit,
        }),
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
        computeTimeToDone(await this.repo.loadRangeDataset(projectId, { from: new Date(fromMs), to: new Date(toMs), type: query.type, teamScope }), {
          kind: 'lead',
          fromMs,
          toMs,
          type: query.type,
          limit: query.limit,
        }),
    );
  }

  async getSummary(
    userId: string,
    projectId: string,
    query: { from?: string; to?: string; teamId?: string },
  ): Promise<AnalyticsSummaryDto> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const { fromMs, toMs } = this.resolveWindow(query.from, query.to, 90);
    const teamScope = await this.resolveTeamScope(userId, projectId, query.teamId);
    const dataset = await this.repo.loadRangeDataset(projectId, { from: new Date(fromMs), to: new Date(toMs), teamScope });
    return { ...computeSummary(dataset, fromMs, toMs), meta: { source: 'live', computedAt: null } };
  }

  async listSnapshots(
    userId: string,
    projectId: string,
    kind?: AnalyticsSnapshotKind,
  ) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    return this.repo.listSnapshots(projectId, kind);
  }

  /**
   * Dispatches a background aggregation job that recomputes the project's
   * analytics into the snapshot cache.
   */
  async recalculate(
    userId: string,
    projectId: string,
    body: RecomputeQueryDto,
  ) {
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

  // ─── Background aggregation (no request/authz) ────────────────────────────

  /**
   * Precomputes default-window metrics and persists them as snapshots.
   * Called by the ANALYTICS_CALCULATION background processor.
   */
  async recalculateProject(
    projectId: string,
    opts: { from?: Date; to?: Date; jobId?: string | null; onProgress?: (p: number) => Promise<void> } = {},
  ): Promise<{
    projectId: string;
    snapshotCount: number;
    jobs: string[];
    computedAt: string;
    rollupCompleted: true;
  }> {
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
      promise: Promise<any>;
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
      promise: Promise.resolve(),
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
      promise: Promise.resolve(),
    });
    await report(35);

    const cycleTime = computeTimeToDone(flowDataset, { kind: 'cycle', fromMs: rangeFrom, toMs });
    snapshots.push({
      kind: AnalyticsSnapshotKind.CYCLE_TIME,
      scope: { from: cycleTime.from, to: cycleTime.to, type: 'all' },
      data: cycleTime as unknown as Record<string, unknown>,
      itemCount: flowDataset.items.length,
      promise: Promise.resolve(),
    });
    await report(55);

    const leadTime = computeTimeToDone(flowDataset, { kind: 'lead', fromMs: rangeFrom, toMs });
    snapshots.push({
      kind: AnalyticsSnapshotKind.LEAD_TIME,
      scope: { from: leadTime.from, to: leadTime.to, type: 'all' },
      data: leadTime as unknown as Record<string, unknown>,
      itemCount: flowDataset.items.length,
      promise: Promise.resolve(),
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
    const toMs = to ? endOfDayLocal(new Date(`${to}T23:59:59.999Z`)).getTime() : Date.now();
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

function endOfDayLocal(d: Date): Date {
  return d;
}

function dateOf(ms: number): string {
  return startOfUtcDay(new Date(ms)).toISOString().slice(0, 10);
}