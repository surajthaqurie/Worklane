import { Injectable } from '@nestjs/common';
import { DashboardsRepository } from './dashboards.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { Permission } from '../authorization/permissions.js';
import type {
  DashboardDataDto,
  SprintSummaryData,
  WidgetLayoutDto,
} from './dto/dashboard.dto.js';

export const DEFAULT_PROJECT_WIDGETS: WidgetLayoutDto[] = [
  { id: 'widget-sprint-summary', type: 'SPRINT_SUMMARY', position: 0, colSpan: 2, rowSpan: 1, visible: true },
  { id: 'widget-burndown', type: 'BURNDOWN', position: 1, colSpan: 1, rowSpan: 1, visible: true },
  { id: 'widget-my-work-items', type: 'MY_WORK_ITEMS', position: 2, colSpan: 2, rowSpan: 1, visible: true },
  { id: 'widget-blocked-items', type: 'BLOCKED_ITEMS', position: 3, colSpan: 1, rowSpan: 1, visible: true },
  { id: 'widget-velocity', type: 'VELOCITY', position: 4, colSpan: 1, rowSpan: 1, visible: true },
  { id: 'widget-team-progress', type: 'TEAM_PROGRESS', position: 5, colSpan: 1, rowSpan: 1, visible: true },
  { id: 'widget-activity', type: 'ACTIVITY', position: 6, colSpan: 1, rowSpan: 1, visible: true },
];

export const DEFAULT_GLOBAL_WIDGETS: WidgetLayoutDto[] = [
  { id: 'widget-my-work-items', type: 'MY_WORK_ITEMS', position: 0, colSpan: 2, rowSpan: 1, visible: true },
  { id: 'widget-blocked-items', type: 'BLOCKED_ITEMS', position: 1, colSpan: 1, rowSpan: 1, visible: true },
  { id: 'widget-activity', type: 'ACTIVITY', position: 2, colSpan: 3, rowSpan: 1, visible: true },
];

@Injectable()
export class DashboardsService {
  private cache = new Map<string, { data: DashboardDataDto; expiresAt: number }>();
  private readonly TTL_MS = 20_000; // 20 seconds cache TTL

  constructor(
    private readonly repo: DashboardsRepository,
    private readonly authz: AuthorizationService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  invalidateCache(userId?: string, projectId?: string | null) {
    if (!userId && !projectId) {
      this.cache.clear();
      return;
    }
    for (const [key] of this.cache.entries()) {
      if (userId && key.startsWith(`${userId}:`)) {
        this.cache.delete(key);
      } else if (projectId && key.includes(`:${projectId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  async getLayout(
    userId: string,
    projectId?: string | null,
  ): Promise<{ projectId: string | null; widgets: WidgetLayoutDto[] }> {
    if (projectId) {
      await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    }

    const row = await this.repo.getLayout(userId, projectId || null);
    if (row && Array.isArray(row.widgets) && row.widgets.length > 0) {
      return {
        projectId: row.project_id,
        widgets: row.widgets as WidgetLayoutDto[],
      };
    }

    return {
      projectId: projectId || null,
      widgets: projectId ? DEFAULT_PROJECT_WIDGETS : DEFAULT_GLOBAL_WIDGETS,
    };
  }

  async saveLayout(
    userId: string,
    projectId: string | null,
    widgets: WidgetLayoutDto[],
  ): Promise<{ projectId: string | null; widgets: WidgetLayoutDto[] }> {
    if (projectId) {
      await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    }

    const updated = await this.repo.upsertLayout(userId, projectId, widgets);
    this.invalidateCache(userId, projectId);

    return {
      projectId: updated.project_id,
      widgets: updated.widgets as WidgetLayoutDto[],
    };
  }

  async resetLayout(
    userId: string,
    projectId: string | null,
  ): Promise<{ projectId: string | null; widgets: WidgetLayoutDto[] }> {
    if (projectId) {
      await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    }

    await this.repo.deleteLayout(userId, projectId);
    this.invalidateCache(userId, projectId);

    return {
      projectId,
      widgets: projectId ? DEFAULT_PROJECT_WIDGETS : DEFAULT_GLOBAL_WIDGETS,
    };
  }

  async getDashboardData(
    userId: string,
    projectId?: string | null,
    teamId?: string | null,
  ): Promise<DashboardDataDto> {
    if (projectId) {
      await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    }

    const cacheKey = `${userId}:${projectId || 'global'}:${teamId || 'all'}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    if (projectId) {
      // Parallel execution for batched data fetching
      const [
        activeIteration,
        myWorkItems,
        blockedItems,
        activity,
        teamProgress,
        velocityData,
      ] = await Promise.all([
        this.repo.getActiveIteration(projectId),
        this.repo.getUserWorkItems(userId, projectId, 15),
        this.repo.getBlockedWorkItems(projectId, 15),
        this.repo.getRecentActivities(projectId, 15),
        this.repo.getTeamProgress(projectId, teamId || null),
        this.analyticsService
          .getVelocity(userId, projectId, { teamId: teamId || undefined })
          .catch(() => null),
      ]);

      let sprintSummary: SprintSummaryData | null = null;
      let burndownData = null;

      if (activeIteration) {
        const statsRows = await this.repo.getIterationStats(activeIteration.id);
        let totalItems = 0;
        let completedItems = 0;
        let inProgressItems = 0;
        let todoItems = 0;
        let totalPoints = 0;
        let completedPoints = 0;

        for (const row of statsRows) {
          totalItems += row.count;
          totalPoints += row.points;
          if (row.is_done) {
            completedItems += row.count;
            completedPoints += row.points;
          } else if (row.category === 'IN_PROGRESS') {
            inProgressItems += row.count;
          } else {
            todoItems += row.count;
          }
        }

        const remainingPoints = Math.max(0, totalPoints - completedPoints);
        const endDateMs = new Date(activeIteration.end_date).getTime();
        const daysRemaining = Math.max(0, Math.ceil((endDateMs - now) / (1000 * 60 * 60 * 24)));

        sprintSummary = {
          iteration: {
            id: activeIteration.id,
            name: activeIteration.name,
            goal: activeIteration.goal,
            startDate:
              activeIteration.start_date instanceof Date
                ? activeIteration.start_date.toISOString()
                : String(activeIteration.start_date),
            endDate:
              activeIteration.end_date instanceof Date
                ? activeIteration.end_date.toISOString()
                : String(activeIteration.end_date),
            state: activeIteration.state,
          },
          totalPoints,
          completedPoints,
          remainingPoints,
          totalItems,
          completedItems,
          inProgressItems,
          todoItems,
          daysRemaining,
        };

        burndownData = await this.analyticsService
          .getBurndown(userId, projectId, {
            iterationId: activeIteration.id,
            teamId: teamId || undefined,
          })
          .catch(() => null);
      }

      const result: DashboardDataDto = {
        scope: {
          projectId,
          teamId: teamId || null,
        },
        sprintSummary,
        burndown: burndownData,
        velocity: velocityData,
        myWorkItems,
        blockedItems,
        activity,
        teamProgress,
        generatedAt: new Date().toISOString(),
      };

      this.cache.set(cacheKey, { data: result, expiresAt: now + this.TTL_MS });
      return result;
    }

    // Global scope (no projectId)
    const [myWorkItems, blockedItems, activity] = await Promise.all([
      this.repo.getUserWorkItems(userId, null, 15),
      this.repo.getBlockedWorkItems(null, 15),
      this.repo.getRecentActivities(null, 15),
    ]);

    const result: DashboardDataDto = {
      scope: {
        projectId: null,
        teamId: null,
      },
      sprintSummary: null,
      burndown: null,
      velocity: null,
      myWorkItems,
      blockedItems,
      activity,
      teamProgress: [],
      generatedAt: new Date().toISOString(),
    };

    this.cache.set(cacheKey, { data: result, expiresAt: now + this.TTL_MS });
    return result;
  }
}
