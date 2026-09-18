import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { IterationsService } from './iterations.service.js';
import { IterationsRepository } from './iterations.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { TeamsService } from '../teams/teams.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

describe('IterationsService', () => {
  let service: IterationsService;
  let repo: any;
  let projectsService: any;
  let teamsService: any;
  let authz: any;

  const iteration = {
    id: 'it-1',
    projectId: 'p1',
    name: 'Sprint 1',
    goal: null,
    startDate: new Date('2026-01-05T00:00:00.000Z'),
    endDate: new Date('2026-01-19T00:00:00.000Z'),
    state: 'PLANNED' as const,
    parentId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const dto = {
    name: 'Sprint 1',
    startDate: '2026-01-05T00:00:00.000Z',
    endDate: '2026-01-19T00:00:00.000Z',
  };

  beforeEach(async () => {
    repo = {
      validateDates: vi.fn(),
      checkDateOverlap: vi.fn(),
      validateParent: vi.fn(),
      countChildren: vi.fn(),
      create: vi.fn(),
      addHistory: vi.fn(),
      findAllByProject: vi.fn(),
      findOne: vi.fn(),
      findActiveByProject: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      completeIteration: vi.fn(),
      moveItemsToIteration: vi.fn(),
      addWorkItems: vi.fn(),
      removeWorkItem: vi.fn(),
      getSprintWorkItems: vi.fn(),
      getWorkflowStates: vi.fn(),
    };

    projectsService = {
      assertProjectMember: vi.fn(),
      findOne: vi.fn(),
    };

    teamsService = {
      assertTeamMember: vi.fn(),
      getTeamScope: vi.fn(),
    };

    authz = {
      requireProjectPermission: vi.fn().mockImplementation(async (projectId, userId) => ({
        projectId,
        userId,
        role: 'ADMIN',
      })),
      requireProjectMember: vi.fn(),
      requireProjectPermissionWithProject: vi.fn().mockImplementation(
        async (projectId, userId) => ({
          project: { id: projectId, key: 'PROJ' },
          membership: { projectId, userId, role: 'ADMIN' },
        }),
      ),
    };

    const notifications = {
      notifyAddedToSprint: vi.fn(),
      notifyRemovedFromSprint: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IterationsService,
        { provide: IterationsRepository, useValue: repo },
        { provide: ProjectsService, useValue: projectsService },
        { provide: TeamsService, useValue: teamsService },
        { provide: AuthorizationService, useValue: authz },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<IterationsService>(IterationsService);
  });

  // ─── Authorization ─────────────────────────────────────────────────────────

  it('should throw ForbiddenException when user is not a project member', async () => {
    authz.requireProjectPermission.mockRejectedValue(new ForbiddenException());
    await expect(service.create('u1', 'p1', { ...dto })).rejects.toThrow(
      ForbiddenException,
    );
  });

  // ─── Create ───────────────────────────────────────────────────────────────

  it('should reject invalid date ranges on create', async () => {
    repo.validateDates.mockImplementation(() => {
      throw new BadRequestException('End date must be after start date');
    });
    await expect(service.create('u1', 'p1', { ...dto })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should validate parent iteration when creating', async () => {
    repo.create.mockResolvedValue(iteration);
    await service.create('u1', 'p1', { ...dto, parentId: 'it-0' });
    expect(repo.validateParent).toHaveBeenCalledWith('p1', 'it-0');
    expect(repo.checkDateOverlap).toHaveBeenCalledWith('p1', dto.startDate, dto.endDate, 'it-0');
    expect(repo.addHistory).toHaveBeenCalledWith(iteration.id, 'u1', 'CREATED');
  });

  it('should skip parent validation when no parentId provided', async () => {
    repo.create.mockResolvedValue(iteration);
    await service.create('u1', 'p1', { ...dto });
    expect(repo.validateParent).not.toHaveBeenCalled();
  });

  // ─── Update ───────────────────────────────────────────────────────────────

  it('should throw NotFound when updating a missing iteration', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.update('u1', 'p1', 'nope', { name: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should forbid state changes via update', async () => {
    repo.findOne.mockResolvedValue(iteration);
    await expect(
      service.update('u1', 'p1', iteration.id, { state: 'ACTIVE' }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('should validate parent hierarchy on update', async () => {
    repo.findOne.mockResolvedValue(iteration);
    repo.update.mockResolvedValue({ ...iteration, parentId: 'it-0' });
    await service.update('u1', 'p1', iteration.id, { parentId: 'it-0' });
    expect(repo.validateParent).toHaveBeenCalledWith('p1', 'it-0', iteration.id);
  });

  it('should validate dates and overlap when updating dates', async () => {
    repo.findOne.mockResolvedValue(iteration);
    repo.update.mockResolvedValue(iteration);
    await service.update('u1', 'p1', iteration.id, {
      startDate: '2026-02-01T00:00:00.000Z',
      endDate: '2026-02-15T00:00:00.000Z',
    });
    expect(repo.validateDates).toHaveBeenCalled();
    expect(repo.checkDateOverlap).toHaveBeenCalledWith(
      'p1',
      '2026-02-01T00:00:00.000Z',
      '2026-02-15T00:00:00.000Z',
      iteration.parentId,
      iteration.id,
    );
  });

  // ─── Activate ─────────────────────────────────────────────────────────────

  it('should not activate a completed iteration', async () => {
    repo.findOne.mockResolvedValue({ ...iteration, state: 'COMPLETED' });
    await expect(service.activate('u1', 'p1', iteration.id)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should be idempotent when already active', async () => {
    repo.findOne.mockResolvedValue({ ...iteration, state: 'ACTIVE' });
    const result = await service.activate('u1', 'p1', iteration.id);
    expect(repo.update).not.toHaveBeenCalled();
    expect(result.state).toBe('ACTIVE');
  });

  it('should reject activating when another sprint is active', async () => {
    repo.findOne.mockResolvedValue(iteration);
    repo.findActiveByProject.mockResolvedValue({ ...iteration, id: 'it-2' });
    await expect(service.activate('u1', 'p1', iteration.id)).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('should activate a planned iteration', async () => {
    repo.findOne.mockResolvedValue(iteration);
    repo.findActiveByProject.mockResolvedValue(null);
    repo.update.mockResolvedValue({ ...iteration, state: 'ACTIVE' });
    const result = await service.activate('u1', 'p1', iteration.id);
    expect(repo.update).toHaveBeenCalledWith(iteration.id, { state: 'ACTIVE' });
    expect(repo.addHistory).toHaveBeenCalledWith(
      iteration.id,
      'u1',
      'ACTIVATED',
      'state',
      'PLANNED',
      'ACTIVE',
    );
    expect(result.state).toBe('ACTIVE');
  });

  // ─── Complete ─────────────────────────────────────────────────────────────

  it('should only complete active iterations', async () => {
    repo.findOne.mockResolvedValue(iteration);
    await expect(
      service.completeIteration('u1', 'p1', iteration.id, {
        incompleteAction: 'MOVE_TO_BACKLOG',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should require targetIterationId when moving to next', async () => {
    repo.findOne.mockResolvedValue({ ...iteration, state: 'ACTIVE' });
    await expect(
      service.completeIteration('u1', 'p1', iteration.id, {
        incompleteAction: 'MOVE_TO_NEXT',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject a target iteration from another project', async () => {
    repo.findOne.mockResolvedValue({ ...iteration, state: 'ACTIVE' });
    repo.findOne.mockResolvedValueOnce(
      Promise.resolve({ ...iteration, state: 'ACTIVE', id: iteration.id }),
    );
    repo.findOne.mockResolvedValueOnce(
      Promise.resolve({ ...iteration, id: 'it-target', projectId: 'OTHER' }),
    );
    await expect(
      service.completeIteration('u1', 'p1', iteration.id, {
        incompleteAction: 'MOVE_TO_NEXT',
        targetIterationId: 'it-target',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should not move items into a completed target', async () => {
    repo.findOne.mockResolvedValue({ ...iteration, state: 'ACTIVE' });
    repo.findOne.mockResolvedValueOnce(
      Promise.resolve({ ...iteration, state: 'ACTIVE', id: iteration.id }),
    );
    repo.findOne.mockResolvedValueOnce(
      Promise.resolve({ ...iteration, id: 'it-target', state: 'COMPLETED' }),
    );
    await expect(
      service.completeIteration('u1', 'p1', iteration.id, {
        incompleteAction: 'MOVE_TO_NEXT',
        targetIterationId: 'it-target',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should move incomplete items to the target iteration on complete', async () => {
    const active = { ...iteration, state: 'ACTIVE' };
    const target = { ...iteration, id: 'it-target', state: 'PLANNED' };
    const incomplete = [{ id: 'wi-1', title: 'Task', state: 'TODO' }];
    repo.findOne
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(target)
      .mockResolvedValue(active);
    repo.completeIteration.mockResolvedValue({ incompleteItems: incomplete });
    repo.moveItemsToIteration.mockResolvedValue(undefined);

    const result = await service.completeIteration('u1', 'p1', iteration.id, {
      incompleteAction: 'MOVE_TO_NEXT',
      targetIterationId: 'it-target',
    });

    expect(repo.completeIteration).toHaveBeenCalledWith(iteration.id, 'u1');
    expect(repo.moveItemsToIteration).toHaveBeenCalledWith(
      ['wi-1'],
      'it-target',
      'u1',
    );
    expect(result.movedCount).toBe(1);
    expect(result.incompleteItems).toEqual(incomplete);
  });

  it('should move incomplete items back to the backlog on complete', async () => {
    const incomplete = [{ id: 'wi-1', title: 'Task', state: 'TODO' }];
    repo.findOne.mockResolvedValue({ ...iteration, state: 'ACTIVE' });
    repo.completeIteration.mockResolvedValue({ incompleteItems: incomplete });

    await service.completeIteration('u1', 'p1', iteration.id, {
      incompleteAction: 'MOVE_TO_BACKLOG',
    });

    expect(repo.moveItemsToIteration).toHaveBeenCalledWith(['wi-1'], null, 'u1');
  });

  // ─── Delete ───────────────────────────────────────────────────────────────

  it('should not delete a missing iteration', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.remove('u1', 'p1', 'nope')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should not delete an active iteration', async () => {
    repo.findOne.mockResolvedValue({ ...iteration, state: 'ACTIVE' });
    await expect(service.remove('u1', 'p1', iteration.id)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should not delete an iteration that has children', async () => {
    repo.findOne.mockResolvedValue(iteration);
    repo.countChildren.mockResolvedValue(2);
    await expect(service.remove('u1', 'p1', iteration.id)).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('should delete an iteration without children', async () => {
    repo.findOne.mockResolvedValue(iteration);
    repo.countChildren.mockResolvedValue(0);
    const result = await service.remove('u1', 'p1', iteration.id);
    expect(repo.addHistory).toHaveBeenCalledWith(iteration.id, 'u1', 'DELETED');
    expect(repo.remove).toHaveBeenCalledWith(iteration.id);
    expect(result).toEqual({ success: true });
  });

  it('should reject completing an iteration into itself', async () => {
    repo.findOne.mockResolvedValue({ ...iteration, state: 'ACTIVE' });
    await expect(
      service.completeIteration('u1', 'p1', iteration.id, {
        incompleteAction: 'MOVE_TO_NEXT',
        targetIterationId: iteration.id,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.completeIteration).not.toHaveBeenCalled();
  });

  // ─── Remove work item ──────────────────────────────────────────────────────

  it('should remove a work item scoped to the iteration', async () => {
    repo.findOne.mockResolvedValue(iteration);
    repo.removeWorkItem.mockResolvedValue(undefined);
    const result = await service.removeWorkItem(
      'u1',
      'p1',
      iteration.id,
      'wi-1',
    );
    expect(repo.removeWorkItem).toHaveBeenCalledWith(
      iteration.id,
      'wi-1',
      'u1',
    );
    expect(result).toEqual({ success: true });
  });

  it('should throw when removing a work item from a missing iteration', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.removeWorkItem('u1', 'p1', 'nope', 'wi-1'),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── Bulk move ─────────────────────────────────────────────────────────────

  it('should no-op when bulk-moving items to the same iteration', async () => {
    repo.findOne.mockResolvedValue(iteration);
    const result = await service.bulkMoveWorkItems('u1', 'p1', iteration.id, {
      workItemIds: ['wi-1', 'wi-2'],
      targetIterationId: iteration.id,
    });
    expect(repo.moveItemsToIteration).not.toHaveBeenCalled();
    expect(result.movedCount).toBe(0);
  });

  it('should bulk-move items to a target iteration', async () => {
    const target = { ...iteration, id: 'it-target' };
    repo.findOne
      .mockResolvedValueOnce(iteration)
      .mockResolvedValueOnce(target);
    repo.moveItemsToIteration.mockResolvedValue(undefined);

    const result = await service.bulkMoveWorkItems('u1', 'p1', iteration.id, {
      workItemIds: ['wi-1'],
      targetIterationId: 'it-target',
    });

    expect(repo.moveItemsToIteration).toHaveBeenCalledWith(
      ['wi-1'],
      'it-target',
      'u1',
    );
    expect(result.movedCount).toBe(1);
  });

  it('should reject bulk-moving items to an iteration in another project', async () => {
    repo.findOne
      .mockResolvedValueOnce(iteration)
      .mockResolvedValueOnce({ ...iteration, id: 'it-target', projectId: 'OTHER' });
    await expect(
      service.bulkMoveWorkItems('u1', 'p1', iteration.id, {
        workItemIds: ['wi-1'],
        targetIterationId: 'it-target',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── Sprint board ─────────────────────────────────────────────────────────

  it('should throw when sprint board target does not exist', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.getSprintBoard('u1', 'p1', 'nope')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should group sprint work items by workflow state', async () => {
    repo.findOne.mockResolvedValue(iteration);
    repo.getSprintWorkItems.mockResolvedValue([
      { id: 'a', state: 'TODO', title: 'A' },
      { id: 'b', state: 'IN_PROGRESS', title: 'B' },
    ]);
    repo.getWorkflowStates.mockResolvedValue([
      { id: 's1', key: 'TODO', name: 'To Do', color: '#111', sortOrder: 0, isDone: false },
      { id: 's2', key: 'IN_PROGRESS', name: 'In Progress', color: '#222', sortOrder: 1, isDone: false },
      { id: 's3', key: 'DONE', name: 'Done', color: '#333', sortOrder: 2, isDone: true },
    ]);

    const result = await service.getSprintBoard('u1', 'p1', iteration.id);

    expect(result.total).toBe(2);
    expect(result.groups).toHaveLength(3);
    expect(result.groups[0].items).toHaveLength(1);
    expect(result.groups[1].items).toHaveLength(1);
    expect(result.groups[2].items).toHaveLength(0);
  });
});