import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardsService, DEFAULT_GLOBAL_WIDGETS, DEFAULT_PROJECT_WIDGETS } from './dashboards.service.js';
import { DashboardsRepository } from './dashboards.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { Permission } from '../authorization/permissions.js';

describe('DashboardsService', () => {
  let service: DashboardsService;
  let repo: DashboardsRepository;
  let authz: AuthorizationService;
  let analytics: AnalyticsService;

  beforeEach(() => {
    repo = {
      getLayout: vi.fn().mockResolvedValue(null),
      upsertLayout: vi.fn().mockImplementation((userId, projectId, widgets) =>
        Promise.resolve({
          id: 'layout-1',
          user_id: userId,
          project_id: projectId,
          widgets,
          created_at: new Date(),
          updated_at: new Date(),
        }),
      ),
      deleteLayout: vi.fn().mockResolvedValue({}),
      getActiveIteration: vi.fn().mockResolvedValue({
        id: 'it-1',
        name: 'Sprint 1',
        goal: 'Complete core features',
        start_date: new Date('2026-09-20'),
        end_date: new Date('2026-10-04'),
        state: 'ACTIVE',
      }),
      getIterationStats: vi.fn().mockResolvedValue([
        { state: 'TODO', category: 'PROPOSED', is_done: false, count: 5, points: 15 },
        { state: 'IN_PROGRESS', category: 'IN_PROGRESS', is_done: false, count: 3, points: 9 },
        { state: 'DONE', category: 'COMPLETED', is_done: true, count: 2, points: 6 },
      ]),
      getUserWorkItems: vi.fn().mockResolvedValue([
        {
          id: 'wi-1',
          seqNo: 101,
          projectKey: 'PROJ',
          title: 'Implement dashboard',
          type: 'STORY',
          state: 'IN_PROGRESS',
          priority: 'HIGH',
          points: 5,
          updatedAt: '2026-09-25T10:00:00.000Z',
        },
      ]),
      getBlockedWorkItems: vi.fn().mockResolvedValue([
        {
          id: 'wi-2',
          seqNo: 102,
          projectKey: 'PROJ',
          title: 'Blocked task',
          type: 'TASK',
          state: 'TODO',
          priority: 'MEDIUM',
          blockedBy: {
            id: 'wi-1',
            seqNo: 101,
            projectKey: 'PROJ',
            title: 'Implement dashboard',
            state: 'IN_PROGRESS',
          },
          reason: 'Blocked by PROJ-101 (IN_PROGRESS)',
        },
      ]),
      getRecentActivities: vi.fn().mockResolvedValue([
        {
          id: 'act-1',
          action: 'STATE_CHANGED',
          field: 'state',
          oldValue: 'TODO',
          newValue: 'IN_PROGRESS',
          createdAt: '2026-09-25T11:00:00.000Z',
          workItemSeq: 101,
          workItemTitle: 'Implement dashboard',
          userName: 'Alice',
          userAvatar: null,
        },
      ]),
      getTeamProgress: vi.fn().mockResolvedValue([
        {
          userId: 'u-1',
          name: 'Alice',
          avatarUrl: null,
          assignedCount: 4,
          inProgressCount: 2,
          doneCount: 2,
          totalPoints: 14,
        },
      ]),
    } as unknown as DashboardsRepository;

    authz = {
      requireProjectPermission: vi.fn().mockResolvedValue({
        projectId: 'p-1',
        userId: 'u-1',
        role: 'MEMBER',
      }),
    } as unknown as AuthorizationService;

    analytics = {
      getBurndown: vi.fn().mockResolvedValue({
        iterationId: 'it-1',
        iterationName: 'Sprint 1',
        startDate: '2026-09-20',
        endDate: '2026-10-04',
        totalScopeItems: 10,
        totalScopePoints: 30,
        completedPoints: 6,
        remainingPoints: 24,
        points: [],
        ideal: [],
      }),
      getVelocity: vi.fn().mockResolvedValue({
        projectId: 'p-1',
        from: '2026-03-01',
        to: '2026-09-25',
        iterations: [],
        averageVelocity: 15,
      }),
    } as unknown as AnalyticsService;

    service = new DashboardsService(repo, authz, analytics);
  });

  describe('getLayout', () => {
    it('returns default project widgets when no custom layout exists', async () => {
      const result = await service.getLayout('u-1', 'p-1');
      expect(authz.requireProjectPermission).toHaveBeenCalledWith(
        'p-1',
        'u-1',
        Permission.PROJECT_VIEW,
      );
      expect(result.projectId).toBe('p-1');
      expect(result.widgets).toEqual(DEFAULT_PROJECT_WIDGETS);
    });

    it('returns default global widgets when projectId is omitted and no custom layout exists', async () => {
      const result = await service.getLayout('u-1');
      expect(authz.requireProjectPermission).not.toHaveBeenCalled();
      expect(result.projectId).toBeNull();
      expect(result.widgets).toEqual(DEFAULT_GLOBAL_WIDGETS);
    });

    it('returns saved layout from database when present', async () => {
      const customWidgets = [
        { id: 'w1', type: 'ACTIVITY' as const, position: 0, colSpan: 3, rowSpan: 1, visible: true },
      ];
      vi.mocked(repo.getLayout).mockResolvedValueOnce({
        id: 'l-1',
        user_id: 'u-1',
        project_id: 'p-1',
        widgets: customWidgets,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.getLayout('u-1', 'p-1');
      expect(result.widgets).toEqual(customWidgets);
    });
  });

  describe('saveLayout', () => {
    it('persists customized layout and invalidates cache', async () => {
      const customWidgets = [
        { id: 'w1', type: 'MY_WORK_ITEMS' as const, position: 0, colSpan: 2, rowSpan: 1, visible: true },
        { id: 'w2', type: 'BURNDOWN' as const, position: 1, colSpan: 1, rowSpan: 1, visible: false },
      ];

      const result = await service.saveLayout('u-1', 'p-1', customWidgets);

      expect(authz.requireProjectPermission).toHaveBeenCalledWith(
        'p-1',
        'u-1',
        Permission.PROJECT_VIEW,
      );
      expect(repo.upsertLayout).toHaveBeenCalledWith('u-1', 'p-1', customWidgets);
      expect(result.widgets).toEqual(customWidgets);
    });
  });

  describe('resetLayout', () => {
    it('deletes custom layout and returns defaults', async () => {
      const result = await service.resetLayout('u-1', 'p-1');

      expect(authz.requireProjectPermission).toHaveBeenCalledWith(
        'p-1',
        'u-1',
        Permission.PROJECT_VIEW,
      );
      expect(repo.deleteLayout).toHaveBeenCalledWith('u-1', 'p-1');
      expect(result.widgets).toEqual(DEFAULT_PROJECT_WIDGETS);
    });
  });

  describe('getDashboardData', () => {
    it('batches and aggregates project metrics in a single call', async () => {
      const data = await service.getDashboardData('u-1', 'p-1');

      expect(authz.requireProjectPermission).toHaveBeenCalledWith(
        'p-1',
        'u-1',
        Permission.PROJECT_VIEW,
      );
      expect(repo.getActiveIteration).toHaveBeenCalledWith('p-1');
      expect(repo.getUserWorkItems).toHaveBeenCalledWith('u-1', 'p-1', 15);
      expect(repo.getBlockedWorkItems).toHaveBeenCalledWith('p-1', 15);
      expect(repo.getRecentActivities).toHaveBeenCalledWith('p-1', 15);
      expect(repo.getTeamProgress).toHaveBeenCalledWith('p-1', null);
      expect(analytics.getBurndown).toHaveBeenCalledWith('u-1', 'p-1', {
        iterationId: 'it-1',
        teamId: undefined,
      });

      expect(data.sprintSummary).not.toBeNull();
      expect(data.sprintSummary?.totalPoints).toBe(30);
      expect(data.sprintSummary?.completedPoints).toBe(6);
      expect(data.sprintSummary?.remainingPoints).toBe(24);
      expect(data.myWorkItems).toHaveLength(1);
      expect(data.blockedItems).toHaveLength(1);
      expect(data.activity).toHaveLength(1);
      expect(data.teamProgress).toHaveLength(1);
    });

    it('caches response and avoids duplicate queries on subsequent calls within TTL', async () => {
      // First call
      await service.getDashboardData('u-1', 'p-1');
      expect(repo.getUserWorkItems).toHaveBeenCalledTimes(1);

      // Second call immediately after
      const cached = await service.getDashboardData('u-1', 'p-1');
      expect(repo.getUserWorkItems).toHaveBeenCalledTimes(1); // Cached! Did NOT call repo again
      expect(cached.myWorkItems).toHaveLength(1);
    });

    it('supports global scope when projectId is omitted', async () => {
      const data = await service.getDashboardData('u-1');

      expect(authz.requireProjectPermission).not.toHaveBeenCalled();
      expect(repo.getUserWorkItems).toHaveBeenCalledWith('u-1', null, 15);
      expect(repo.getBlockedWorkItems).toHaveBeenCalledWith(null, 15);
      expect(repo.getRecentActivities).toHaveBeenCalledWith(null, 15);
      expect(data.scope.projectId).toBeNull();
    });
  });
});
