import { describe, it, expect, beforeEach, vi, type Mocked } from 'vitest';
import { WorkItemsService } from './work-items.service.js';
import { WorkItemsRepository } from './work-items.repository.js';
import { WorkItemTypeRegistryService } from './work-item-types.registry.js';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('Hierarchy & Rollup Engine (Phase 12)', () => {
  let service: WorkItemsService;
  let repo: Mocked<WorkItemsRepository>;
  let authz: any;
  let projectsService: any;
  let teamsService: any;
  let notifications: any;
  let typeRegistry: WorkItemTypeRegistryService;

  const projectId = 'proj-123';
  const userId = 'user-123';

  beforeEach(() => {
    repo = {
      getWorkItemById: vi.fn(),
      getBatchRollups: vi.fn(),
      getHierarchyTree: vi.fn(),
      createWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
      deleteWorkItem: vi.fn(),
    } as any;

    authz = {
      requireProjectPermission: vi.fn().mockResolvedValue(true),
      requireProjectPermissionWithProject: vi.fn().mockResolvedValue({
        project: { id: projectId, key: 'PROJ' },
      }),
    };

    projectsService = {};
    teamsService = {};
    notifications = {};
    typeRegistry = new WorkItemTypeRegistryService();

    service = new WorkItemsService(
      repo,
      projectsService as any,
      teamsService as any,
      authz as any,
      notifications as any,
      typeRegistry,
    );
  });

  describe('Parent Validation & Hierarchy Protection', () => {
    it('should disallow setting self as parent', async () => {
      await expect(
        service.validateParentAndCircularity('item-1', 'item-1', projectId, 'STORY'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should disallow cross-project parent assignment', async () => {
      repo.getWorkItemById.mockImplementation(async (id: string) => {
        if (id === 'parent-other-project') {
          return { id: 'parent-other-project', project_id: 'other-proj-999', type: 'EPIC' } as any;
        }
        if (id === 'item-1') {
          return { id: 'item-1', project_id: projectId, type: 'FEATURE' } as any;
        }
        return null;
      });

      await expect(
        service.validateParentAndCircularity('item-1', 'parent-other-project', projectId, 'FEATURE'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should disallow invalid parent types (e.g. TASK parenting EPIC)', async () => {
      repo.getWorkItemById.mockResolvedValueOnce({
        id: 'task-1',
        project_id: projectId,
        type: 'TASK',
      } as any);

      await expect(
        service.validateParentAndCircularity('epic-1', 'task-1', projectId, 'EPIC'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should detect circular parent dependencies', async () => {
      // Setup chain: item-1 -> item-2 -> item-3 -> item-1 (cycle)
      repo.getWorkItemById.mockImplementation(async (id: string) => {
        if (id === 'item-2') return { id: 'item-2', parent_id: 'item-3', project_id: projectId, type: 'FEATURE' } as any;
        if (id === 'item-3') return { id: 'item-3', parent_id: 'item-1', project_id: projectId, type: 'EPIC' } as any;
        return null;
      });

      await expect(
        service.validateParentAndCircularity('item-1', 'item-2', projectId, 'STORY'),
      ).rejects.toThrow(/Circular dependency/);
    });

    it('should prevent excessive hierarchy depth (> 10)', async () => {
      // Chain of depth 11
      repo.getWorkItemById.mockImplementation(async (id: string) => {
        const match = id.match(/^item-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > 0) {
            return {
              id: `item-${num}`,
              parent_id: `item-${num - 1}`,
              project_id: projectId,
              type: num > 5 ? 'FEATURE' : 'EPIC',
            } as any;
          }
        }
        return null;
      });

      await expect(
        service.validateParentAndCircularity('item-12', 'item-11', projectId, 'STORY'),
      ).rejects.toThrow(/depth limit exceeded/);
    });
  });

  describe('Rollups Engine', () => {
    it('should fetch single item rollup successfully', async () => {
      const mockRollup = {
        itemId: 'epic-1',
        descendantCount: 5,
        completedCount: 3,
        totalPoints: 20,
        completedPoints: 12,
        remainingWork: 15,
        completedWork: 25,
        completionPercentage: 60,
      };

      repo.getWorkItemById.mockResolvedValueOnce({ id: 'epic-1', project_id: projectId } as any);
      repo.getBatchRollups.mockResolvedValueOnce({ 'epic-1': mockRollup });

      const res = await service.getWorkItemRollup(userId, projectId, 'epic-1');

      expect(res).toEqual(mockRollup);
      expect(repo.getBatchRollups).toHaveBeenCalledWith(projectId, ['epic-1']);
    });

    it('should fetch batch rollups in a single repository call', async () => {
      const mockBatch = {
        'epic-1': {
          itemId: 'epic-1',
          descendantCount: 4,
          completedCount: 2,
          totalPoints: 10,
          completedPoints: 5,
          remainingWork: 10,
          completedWork: 10,
          completionPercentage: 50,
        },
        'epic-2': {
          itemId: 'epic-2',
          descendantCount: 2,
          completedCount: 2,
          totalPoints: 8,
          completedPoints: 8,
          remainingWork: 0,
          completedWork: 16,
          completionPercentage: 100,
        },
      };

      repo.getBatchRollups.mockResolvedValueOnce(mockBatch);

      const res = await service.getBatchWorkItemRollups(userId, projectId, ['epic-1', 'epic-2']);

      expect(res).toEqual(mockBatch);
      expect(repo.getBatchRollups).toHaveBeenCalledWith(projectId, ['epic-1', 'epic-2']);
    });

    it('should throw NotFoundException if work item does not exist when fetching rollup', async () => {
      repo.getWorkItemById.mockResolvedValueOnce(null as any);

      await expect(
        service.getWorkItemRollup(userId, projectId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Hierarchy Tree Endpoint', () => {
    it('should return full hierarchy tree with root item, ancestors, and descendants', async () => {
      const mockHierarchy = {
        item: {
          id: 'epic-1',
          type: 'EPIC',
          title: 'Main Epic',
          children: [
            {
              id: 'feat-1',
              type: 'FEATURE',
              title: 'Feature 1',
              parentId: 'epic-1',
              children: [],
            },
          ],
        },
        ancestors: [],
        rollup: {
          itemId: 'epic-1',
          descendantCount: 1,
          completedCount: 0,
          totalPoints: 5,
          completedPoints: 0,
          remainingWork: 8,
          completedWork: 0,
          completionPercentage: 0,
        },
      };

      repo.getHierarchyTree.mockResolvedValueOnce(mockHierarchy as any);

      const res = await service.getWorkItemHierarchy(userId, projectId, 'epic-1');

      expect(res).toEqual(mockHierarchy);
      expect(repo.getHierarchyTree).toHaveBeenCalledWith(projectId, 'epic-1');
    });

    it('should throw NotFoundException if target item is not in project', async () => {
      repo.getHierarchyTree.mockResolvedValueOnce(null);

      await expect(
        service.getWorkItemHierarchy(userId, projectId, 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
