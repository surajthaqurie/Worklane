import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsSnapshotKind } from './dto/analytics.dto.js';
import { JobType } from '../background-jobs/dto/background-job.dto.js';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let repo: any;
  let authz: any;
  let teamsService: any;
  let backgroundJobs: any;

  const PROJECT_ID = 'p1';
  const USER_ID = 'u1';
  const TEAM_ID = 't1';

  const mockIterations = [
    {
      id: 'sprint-1',
      projectId: PROJECT_ID,
      name: 'Sprint 1',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-07T00:00:00.000Z'),
      state: 'COMPLETED' as const,
    },
    {
      id: 'sprint-2',
      projectId: PROJECT_ID,
      name: 'Sprint 2',
      startDate: new Date('2026-06-08T00:00:00.000Z'),
      endDate: new Date('2026-06-14T00:00:00.000Z'),
      state: 'ACTIVE' as const,
    },
  ];

  const mockStates = [
    { key: 'TODO', name: 'To Do', color: '#9ca3af', sortOrder: 1, category: 'PROPOSED' as const, isDone: false, isDefault: true },
    { key: 'IN_PROGRESS', name: 'In Progress', color: '#3b82f6', sortOrder: 2, category: 'IN_PROGRESS' as const, isDone: false, isDefault: false },
    { key: 'DONE', name: 'Done', color: '#10b981', sortOrder: 3, category: 'COMPLETED' as const, isDone: true, isDefault: false },
  ];

  const mockItems = [
    {
      id: 'item-1',
      projectId: PROJECT_ID,
      seqNo: 1,
      iterationId: 'sprint-1',
      areaId: 'area-1',
      type: 'STORY' as const,
      title: 'Story 1',
      state: 'DONE',
      points: 5,
      createdAt: new Date('2026-06-01T09:00:00.000Z'),
      completedAt: new Date('2026-06-04T09:00:00.000Z'),
      closedAt: null,
      deletedAt: null,
    },
  ];

  const mockHistory = [
    {
      id: 'h1',
      workItemId: 'item-1',
      action: 'STATE_CHANGED',
      field: 'state',
      oldValue: 'TODO',
      newValue: 'IN_PROGRESS',
      createdAt: new Date('2026-06-02T09:00:00.000Z'),
      insertedAt: new Date('2026-06-02T09:00:00.000Z'),
    },
    {
      id: 'h2',
      workItemId: 'item-1',
      action: 'STATE_CHANGED',
      field: 'state',
      oldValue: 'IN_PROGRESS',
      newValue: 'DONE',
      createdAt: new Date('2026-06-04T09:00:00.000Z'),
      insertedAt: new Date('2026-06-04T09:00:00.000Z'),
    },
  ];

  const dataset = {
    iterations: mockIterations,
    states: mockStates,
    items: mockItems,
    history: mockHistory,
  };

  beforeEach(() => {
    repo = {
      loadStates: vi.fn().mockResolvedValue(mockStates),
      loadIterations: vi.fn().mockResolvedValue(mockIterations),
      loadIteration: vi.fn().mockImplementation((_pid: string, id: string) =>
        Promise.resolve(mockIterations.find((it) => it.id === id) ?? null),
      ),
      loadIterationDataset: vi.fn().mockResolvedValue(dataset),
      loadRangeDataset: vi.fn().mockResolvedValue(dataset),
      getSnapshot: vi.fn().mockResolvedValue(null),
      upsertSnapshot: vi.fn().mockResolvedValue(undefined),
      listSnapshots: vi.fn().mockResolvedValue([]),
    };

    authz = {
      requireProjectPermission: vi.fn().mockResolvedValue(true),
    };

    teamsService = {
      assertTeamMember: vi.fn().mockResolvedValue(undefined),
      getTeamScope: vi.fn().mockResolvedValue({
        areaIds: ['area-1'],
        iterationIds: ['sprint-1'],
      }),
    };

    backgroundJobs = {
      dispatchJob: vi.fn().mockResolvedValue({ job: { id: 'job-123' }, isDuplicate: false }),
    };

    service = new AnalyticsService(repo, authz, teamsService, backgroundJobs);
  });

  describe('Security & Permissions', () => {
    it('denies access if caller lacks PROJECT_VIEW permission', async () => {
      authz.requireProjectPermission.mockRejectedValue(new ForbiddenException('Insufficient permissions'));

      await expect(service.getBurndown(USER_ID, PROJECT_ID, { iterationId: 'sprint-1' })).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getVelocity(USER_ID, PROJECT_ID, {})).rejects.toThrow(ForbiddenException);
      await expect(service.getCumulativeFlow(USER_ID, PROJECT_ID, {})).rejects.toThrow(ForbiddenException);
      await expect(service.getCycleTime(USER_ID, PROJECT_ID, {})).rejects.toThrow(ForbiddenException);
      await expect(service.getLeadTime(USER_ID, PROJECT_ID, {})).rejects.toThrow(ForbiddenException);
      await expect(service.getSummary(USER_ID, PROJECT_ID, {})).rejects.toThrow(ForbiddenException);
      await expect(service.listSnapshots(USER_ID, PROJECT_ID)).rejects.toThrow(ForbiddenException);
      await expect(service.recalculate(USER_ID, PROJECT_ID, {})).rejects.toThrow(ForbiddenException);
    });

    it('denies team-scoped analytics if caller is not a member of the team', async () => {
      teamsService.assertTeamMember.mockRejectedValue(new ForbiddenException('Not a team member'));

      await expect(
        service.getBurndown(USER_ID, PROJECT_ID, { iterationId: 'sprint-1', teamId: TEAM_ID }),
      ).rejects.toThrow(ForbiddenException);
      await expect(service.getVelocity(USER_ID, PROJECT_ID, { teamId: TEAM_ID })).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getCumulativeFlow(USER_ID, PROJECT_ID, { teamId: TEAM_ID })).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getCycleTime(USER_ID, PROJECT_ID, { teamId: TEAM_ID })).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getLeadTime(USER_ID, PROJECT_ID, { teamId: TEAM_ID })).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getSummary(USER_ID, PROJECT_ID, { teamId: TEAM_ID })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('denies burndown if iteration does not belong to team scope', async () => {
      teamsService.getTeamScope.mockResolvedValue({
        areaIds: ['area-1'],
        iterationIds: ['sprint-1'], // sprint-2 is NOT in team scope
      });

      await expect(
        service.getBurndown(USER_ID, PROJECT_ID, { iterationId: 'sprint-2', teamId: TEAM_ID }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Burndown calculation', () => {
    it('requires iterationId', async () => {
      await expect(service.getBurndown(USER_ID, PROJECT_ID, {})).rejects.toThrow(NotFoundException);
    });

    it('computes live burndown from dataset', async () => {
      const res = await service.getBurndown(USER_ID, PROJECT_ID, { iterationId: 'sprint-1' });

      expect(res.iterationId).toBe('sprint-1');
      expect(res.iterationName).toBe('Sprint 1');
      expect(res.meta.source).toBe('live');
      expect(repo.loadIterationDataset).toHaveBeenCalledWith(PROJECT_ID, 'sprint-1', null);
    });

    it('narrows burndown to team scope when teamId is supplied', async () => {
      await service.getBurndown(USER_ID, PROJECT_ID, { iterationId: 'sprint-1', teamId: TEAM_ID });

      expect(teamsService.assertTeamMember).toHaveBeenCalledWith(PROJECT_ID, TEAM_ID, USER_ID);
      expect(repo.loadIterationDataset).toHaveBeenCalledWith(
        PROJECT_ID,
        'sprint-1',
        { areaIds: ['area-1'], iterationIds: ['sprint-1'] },
      );
    });
  });

  describe('Snapshot caching & serving', () => {
    it('serves cached snapshot when fresh (< 6 hours old)', async () => {
      const cachedVelocity = {
        from: '2026-01-01',
        to: '2026-06-30',
        iterations: [],
        summary: { iterations: 0, totalCommittedPoints: 0, totalCompletedPoints: 0, avgCompletedPoints: 0, lastIteration: null },
      };

      repo.getSnapshot.mockResolvedValue({
        data: cachedVelocity,
        itemCount: 10,
        computedAt: new Date(Date.now() - 60 * 1000).toISOString(), // 1 minute ago
        jobId: 'snap-1',
      });

      const res = await service.getVelocity(USER_ID, PROJECT_ID, { from: '2026-01-01', to: '2026-06-30' });

      expect(res.meta?.source).toBe('snapshot');
      expect(res.meta?.computedAt).toBeTruthy();
      expect(repo.loadRangeDataset).not.toHaveBeenCalled();
    });

    it('falls back to live calculation when snapshot is stale (> 6 hours old)', async () => {
      repo.getSnapshot.mockResolvedValue({
        data: {},
        itemCount: 10,
        computedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
        jobId: 'snap-stale',
      });

      const res = await service.getVelocity(USER_ID, PROJECT_ID, { from: '2026-01-01', to: '2026-06-30' });

      expect(res.meta?.source).toBe('live');
      expect(repo.loadRangeDataset).toHaveBeenCalled();
    });

    it('partitions snapshot scope by teamId', async () => {
      await service.getVelocity(USER_ID, PROJECT_ID, { from: '2026-01-01', to: '2026-06-30', teamId: TEAM_ID });

      expect(repo.getSnapshot).toHaveBeenCalledWith(
        PROJECT_ID,
        AnalyticsSnapshotKind.VELOCITY,
        expect.objectContaining({ teamId: TEAM_ID }),
      );
    });
  });

  describe('Background aggregation & recalculate', () => {
    it('dispatches background ANALYTICS_CALCULATION job and recomputes snapshots', async () => {
      const res = await service.recalculate(USER_ID, PROJECT_ID, { from: '2026-01-01', to: '2026-06-30' });

      expect(backgroundJobs.dispatchJob).toHaveBeenCalledWith({
        jobType: JobType.ANALYTICS_CALCULATION,
        payload: {
          projectId: PROJECT_ID,
          from: '2026-01-01',
          to: '2026-06-30',
        },
        maxRetries: 2,
      });

      expect(res.rollupCompleted).toBe(true);
      expect(res.snapshotCount).toBe(4); // velocity, cfd, cycle, lead
      expect(repo.upsertSnapshot).toHaveBeenCalledTimes(4);
    });

    it('recalculateProject reports progress milestones', async () => {
      const progressCalls: number[] = [];
      const onProgress = async (p: number) => {
        progressCalls.push(p);
      };

      await service.recalculateProject(PROJECT_ID, { onProgress });

      expect(progressCalls).toContain(15);
      expect(progressCalls).toContain(35);
      expect(progressCalls).toContain(55);
      expect(progressCalls).toContain(75);
      expect(progressCalls).toContain(100);
    });
  });
});
