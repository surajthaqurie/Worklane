import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { BacklogRepository } from './backlog.repository.js';
import { WorkItemsRepository } from './work-items.repository.js';
import { WorkItemsService } from './work-items.service.js';
import { WorkItemHistoryService } from '../work-item-history/work-item-history.service.js';
import { WorkItemHistoryRepository } from '../work-item-history/work-item-history.repository.js';
import { db } from '../../db/kysely.js';

import { WorkItemTypeRegistryService } from './work-item-types.registry.js';

describe('Relationship Mutations — Authorization & Concurrency', () => {
  let backlogRepo: BacklogRepository;
  let workItemsService: WorkItemsService;
  let workItemsRepo: WorkItemsRepository;
  let historyService: WorkItemHistoryService;
  let historyRepo: WorkItemHistoryRepository;

  beforeEach(async () => {
    historyRepo = new WorkItemHistoryRepository();
    historyService = new WorkItemHistoryService(historyRepo);
    backlogRepo = new BacklogRepository(historyService);
    workItemsRepo = new WorkItemsRepository(historyService);
    const typeRegistry = new WorkItemTypeRegistryService();
    workItemsService = new WorkItemsService(workItemsRepo, {} as any, {} as any, {} as any, {} as any, typeRegistry);
  });

  describe('Optimistic Concurrency & Recoverable Conflict Response', () => {
    it('returns a recoverable ConflictException payload (409) when reordering with stale expectedVersion', async () => {
      const mockItem = {
        id: '11111111-1111-1111-1111-111111111111',
        parent_id: null,
        backlog_rank: 1000,
        seq_no: 1,
        title: 'Item A',
        iteration_id: null,
        version: 5,
      };

      const executeTakeFirstOrThrowMock = vi.fn().mockResolvedValue(mockItem);

      const createQueryBuilder = () => {
        const queryResult: any = {
          executeTakeFirstOrThrow: executeTakeFirstOrThrowMock,
          executeTakeFirst: vi.fn().mockResolvedValue(mockItem),
          execute: vi.fn().mockResolvedValue([]),
        };
        queryResult.orderBy = vi.fn().mockReturnValue(queryResult);

        const builder: any = {};
        builder.where = vi.fn().mockReturnValue(builder);
        builder.select = vi.fn().mockReturnValue(queryResult);
        return builder;
      };

      const trxMock = {
        selectFrom: vi.fn().mockImplementation(() => createQueryBuilder()),
      };

      vi.spyOn(db, 'transaction').mockReturnValue({
        execute: vi.fn().mockImplementation((cb) => cb(trxMock)),
      } as any);

      try {
        await backlogRepo.reorderItem('proj-1', 'user-1', {
          id: '11111111-1111-1111-1111-111111111111',
          parentId: null,
          newRank: 2000,
          expectedVersion: 4, // Stale! DB is at version 5
        });
        expect.fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        const res = err.getResponse();
        expect(res).toMatchObject({
          statusCode: 409,
          code: 'REORDER_CONCURRENCY_CONFLICT',
          details: {
            itemId: '11111111-1111-1111-1111-111111111111',
            expectedVersion: 4,
            currentVersion: 5,
            reloadRequired: true,
          },
        });
      }
    });

    it('throws ConflictException (409) when bulk assigning iteration with stale expectedVersions', async () => {
      const mockItems = [
        { id: '11111111-1111-1111-1111-111111111111', iteration_id: null, version: 3 },
      ];

      const createQueryBuilder = () => {
        const queryResult: any = {
          executeTakeFirstOrThrow: vi.fn(),
          execute: vi.fn().mockResolvedValue(mockItems),
        };
        queryResult.orderBy = vi.fn().mockReturnValue(queryResult);

        const builder: any = {};
        builder.where = vi.fn().mockReturnValue(builder);
        builder.select = vi.fn().mockReturnValue(queryResult);
        return builder;
      };

      const trxMock = {
        selectFrom: vi.fn().mockImplementation(() => createQueryBuilder()),
      };

      vi.spyOn(db, 'transaction').mockReturnValue({
        execute: vi.fn().mockImplementation((cb) => cb(trxMock)),
      } as any);

      await expect(
        backlogRepo.bulkAssignIteration(
          'proj-1',
          'user-1',
          ['11111111-1111-1111-1111-111111111111'],
          'iter-1',
          { '11111111-1111-1111-1111-111111111111': 2 }, // Stale! DB is at version 3
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Server-Generated Ordering & Scoped Rank Validation', () => {
    it('computes rank strictly on the server using valid scope neighbors', async () => {
      const mockItem = {
        id: 'item-target',
        parent_id: null,
        backlog_rank: 1000,
        seq_no: 1,
        title: 'Target Item',
        version: 1,
      };

      const setMock = vi.fn().mockImplementation(() => {
        const updateBuilder: any = {};
        updateBuilder.where = vi.fn().mockImplementation(() => ({
          where: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValue({ numUpdatedRows: 1 }),
          }),
          executeTakeFirst: vi.fn().mockResolvedValue({ numUpdatedRows: 1 }),
        }));
        return updateBuilder;
      });

      const updateTableMock = vi.fn().mockReturnValue({ set: setMock });

      const createQueryBuilder = () => {
        const queryResult: any = {
          executeTakeFirstOrThrow: vi.fn().mockResolvedValue(mockItem),
          executeTakeFirst: vi.fn().mockResolvedValue({ backlog_rank: 1000 }),
          execute: vi.fn().mockResolvedValue([]),
        };
        queryResult.orderBy = vi.fn().mockReturnValue(queryResult);

        const builder: any = {};
        builder.where = vi.fn().mockReturnValue(builder);
        builder.select = vi.fn().mockReturnValue(queryResult);
        return builder;
      };

      const trxMock = {
        selectFrom: vi.fn().mockImplementation(() => createQueryBuilder()),
        updateTable: updateTableMock,
      };

      vi.spyOn(db, 'transaction').mockReturnValue({
        execute: vi.fn().mockImplementation((cb) => cb(trxMock)),
      } as any);

      vi.spyOn(historyService, 'recordMany').mockResolvedValue([] as any);

      await backlogRepo.reorderItem('proj-1', 'user-1', {
        id: 'item-target',
        parentId: null,
        previousItemId: 'prev-item',
        nextItemId: 'next-item',
        newRank: 999999, // Unauthoritative client rank! MUST BE IGNORED
      });

      // Verify rank was computed on server (1000 from prev & 1000 from next -> avg 1000)
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          backlog_rank: 1000,
        }),
      );
    });

    it('rejects reordering when previous item does not belong to the target scope', async () => {
      const mockItem = {
        id: 'item-target',
        parent_id: 'parent-A',
        backlog_rank: 1000,
        seq_no: 1,
        title: 'Target Item',
        version: 1,
      };

      const createQueryBuilder = () => {
        const queryResult: any = {
          executeTakeFirstOrThrow: vi.fn().mockResolvedValue(mockItem),
          executeTakeFirst: vi.fn().mockResolvedValue(undefined), // neighbor lookup returns undefined (not in scope)
          execute: vi.fn().mockResolvedValue([]),
        };
        queryResult.orderBy = vi.fn().mockReturnValue(queryResult);

        const builder: any = {};
        builder.where = vi.fn().mockReturnValue(builder);
        builder.select = vi.fn().mockReturnValue(queryResult);
        return builder;
      };

      const updateTableMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValue({ numUpdatedRows: 1 }),
          }),
        }),
      });

      const trxMock = {
        selectFrom: vi.fn().mockImplementation(() => createQueryBuilder()),
        updateTable: updateTableMock,
      };

      vi.spyOn(db, 'transaction').mockReturnValue({
        execute: vi.fn().mockImplementation((cb) => cb(trxMock)),
      } as any);

      await expect(
        backlogRepo.reorderItem('proj-1', 'user-1', {
          id: 'item-target',
          parentId: 'parent-A',
          previousItemId: 'invalid-neighbor-from-parent-B',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects reordering when previous item does not belong to target iteration scope', async () => {
      const mockItem = {
        id: 'item-target',
        parent_id: null,
        iteration_id: 'iter-1',
        backlog_rank: 1000,
        seq_no: 1,
        title: 'Target Item',
        version: 1,
      };

      const createQueryBuilder = () => {
        const queryResult: any = {
          executeTakeFirstOrThrow: vi.fn().mockResolvedValue(mockItem),
          executeTakeFirst: vi.fn().mockResolvedValue(undefined),
          execute: vi.fn().mockResolvedValue([]),
        };
        queryResult.orderBy = vi.fn().mockReturnValue(queryResult);

        const builder: any = {};
        builder.where = vi.fn().mockReturnValue(builder);
        builder.select = vi.fn().mockReturnValue(queryResult);
        return builder;
      };

      const trxMock = {
        selectFrom: vi.fn().mockImplementation(() => createQueryBuilder()),
        updateTable: vi.fn(),
      };

      vi.spyOn(db, 'transaction').mockReturnValue({
        execute: vi.fn().mockImplementation((cb) => cb(trxMock)),
      } as any);

      await expect(
        backlogRepo.reorderItem('proj-1', 'user-1', {
          id: 'item-target',
          iterationId: 'iter-1',
          previousItemId: 'neighbor-from-other-iter',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Parent Hierarchy & Circular Dependency Validation', () => {
    it('rejects invalid parent hierarchy during re-parenting', async () => {
      const getWorkItemByIdSpy = vi.spyOn(workItemsRepo, 'getWorkItemById');

      getWorkItemByIdSpy.mockImplementation(async (id: string) => {
        if (id === 'task-1') {
          return { id: 'task-1', project_id: 'proj-1', type: 'TASK', parent_id: null } as any;
        }
        if (id === 'epic-1') {
          return { id: 'epic-1', project_id: 'proj-1', type: 'EPIC', parent_id: null } as any;
        }
        return undefined;
      });

      await expect(
        workItemsService.validateParentAndCircularity('task-1', 'epic-1', 'proj-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects cross-project parent assignment', async () => {
      const getWorkItemByIdSpy = vi.spyOn(workItemsRepo, 'getWorkItemById');

      getWorkItemByIdSpy.mockImplementation(async (id: string) => {
        if (id === 'story-1') {
          return { id: 'story-1', project_id: 'proj-1', type: 'STORY', parent_id: null } as any;
        }
        if (id === 'feature-other-proj') {
          return { id: 'feature-other-proj', project_id: 'proj-2', type: 'FEATURE', parent_id: null } as any;
        }
        return undefined;
      });

      await expect(
        workItemsService.validateParentAndCircularity('story-1', 'feature-other-proj', 'proj-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('detects circular parent dependency', async () => {
      const getWorkItemByIdSpy = vi.spyOn(workItemsRepo, 'getWorkItemById');

      getWorkItemByIdSpy.mockImplementation(async (id: string) => {
        if (id === 'item-A') {
          return { id: 'item-A', project_id: 'proj-1', type: 'FEATURE', parent_id: null } as any;
        }
        if (id === 'item-B') {
          return { id: 'item-B', project_id: 'proj-1', type: 'EPIC', parent_id: 'item-A' } as any;
        }
        return undefined;
      });

      await expect(
        workItemsService.validateParentAndCircularity('item-A', 'item-B', 'proj-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
