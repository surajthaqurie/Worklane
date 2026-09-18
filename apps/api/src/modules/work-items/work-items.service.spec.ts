import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkItemsService } from './work-items.service.js';
import { WorkItemsRepository } from './work-items.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { TeamsService } from '../teams/teams.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { Permission } from '../authorization/permissions.js';

function mockItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wi-1',
    project_id: 'p1',
    seq_no: 7,
    parent_id: null,
    type: 'TASK',
    title: 'Original title',
    description: null,
    state: 'TODO',
    priority: 'MEDIUM',
    points: null,
    assigned_to: null,
    created_by: 'u2',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    completed_at: null,
    closed_at: null,
    iteration_id: null,
    area_id: 'a1',
    backlog_order: 1,
    tags: [],
    ...overrides,
  };
}

describe('WorkItemsService', () => {
  let service: WorkItemsService;
  let repo: any;
  let projectsService: any;
  let teamsService: any;
  let authz: any;
  let notifications: any;
  let givenItems: (rows: any[]) => void;

  beforeEach(async () => {
    givenItems = (rows: any[]) => {
      repo.getWorkItemById.mockImplementation((id: string) =>
        Promise.resolve(rows.find((r) => r.id === id)),
      );
    };
    repo = {
      getWorkItemById: vi.fn(),
      createWorkItem: vi.fn(),
      updateWorkItem: vi.fn().mockResolvedValue(mockItem()),
      deleteWorkItem: vi.fn(),
      getWorkItems: vi.fn(),
      getIterationProjectId: vi.fn(),
      getAreaProjectId: vi.fn(),
      getComments: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
      getActivity: vi.fn(),
    };

    projectsService = {
      assertProjectMember: vi.fn().mockResolvedValue({ id: 'p1', key: 'P1', name: 'Proj' }),
      getMembers: vi.fn().mockResolvedValue([]),
    };

    teamsService = {
      assertTeamMember: vi.fn(),
      getSettings: vi.fn().mockResolvedValue({ defaultAreaId: 'a-default', defaultIterationId: null }),
    };

    authz = {
      requireProjectPermission: vi.fn(async (projectId: string, userId: string) => ({
        projectId,
        userId,
        role: 'ADMIN',
      })),
    };

    notifications = {
      notifyAssigned: vi.fn(),
      notifyAddedToSprint: vi.fn(),
      notifyRemovedFromSprint: vi.fn(),
      notifyParentChanged: vi.fn(),
      notifyStateChanged: vi.fn(),
      notifyMentioned: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkItemsService,
        { provide: WorkItemsRepository, useValue: repo },
        { provide: ProjectsService, useValue: projectsService },
        { provide: TeamsService, useValue: teamsService },
        { provide: AuthorizationService, useValue: authz },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<WorkItemsService>(WorkItemsService);
  });

  describe('create — hierarchy validation', () => {
    it('allows a FEATURE under an EPIC parent', async () => {
      await givenItems([mockItem({ id: 'epic-1', type: 'EPIC', project_id: 'p1' })]);
      repo.createWorkItem.mockResolvedValue(mockItem({ type: 'FEATURE' }));

      await service.create('u1', 'p1', { type: 'FEATURE', title: 'Child', parentId: 'epic-1' });

      expect(repo.createWorkItem).toHaveBeenCalledWith(
        'p1',
        'u1',
        expect.objectContaining({ type: 'FEATURE', title: 'Child', parentId: 'epic-1' }),
      );
    });

    it('rejects a child type out of the parent hierarchy (TASK under EPIC)', async () => {
      await givenItems([mockItem({ id: 'epic-1', type: 'EPIC', project_id: 'p1' })]);
      repo.createWorkItem.mockResolvedValue(mockItem());

      await expect(
        service.create('u1', 'p1', { type: 'TASK', title: 'Child', parentId: 'epic-1' }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.createWorkItem).not.toHaveBeenCalled();
    });

    it('rejects an EPIC that tries to nest under anything', async () => {
      await givenItems([mockItem({ id: 'feature-1', type: 'FEATURE', project_id: 'p1' })]);
      repo.createWorkItem.mockResolvedValue(mockItem());

      await expect(
        service.create('u1', 'p1', { type: 'EPIC', title: 'Root', parentId: 'feature-1' }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.createWorkItem).not.toHaveBeenCalled();
    });

    it('rejects a missing parent', async () => {
      await givenItems([]);

      await expect(
        service.create('u1', 'p1', { type: 'STORY', title: 'Child', parentId: 'ghost' }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.createWorkItem).not.toHaveBeenCalled();
    });

    it('rejects a parent from a different project', async () => {
      await givenItems([mockItem({ id: 'epic-1', type: 'EPIC', project_id: 'p2' })]);

      await expect(
        service.create('u1', 'p1', { type: 'FEATURE', title: 'Child', parentId: 'epic-1' }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.createWorkItem).not.toHaveBeenCalled();
    });

    it('does not look up a parent when none is provided', async () => {
      repo.createWorkItem.mockResolvedValue(mockItem());

      await service.create('u1', 'p1', { type: 'EPIC', title: 'Root' });

      expect(repo.getWorkItemById).not.toHaveBeenCalled();
      expect(repo.createWorkItem).toHaveBeenCalledTimes(1);
    });

    it('requires WORK_ITEM_CREATE before creating', async () => {
      authz.requireProjectPermission.mockRejectedValue(new ForbiddenException());

      await expect(
        service.create('u1', 'p1', { type: 'TASK', title: 'Nope' }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.createWorkItem).not.toHaveBeenCalled();
    });

    it('notifies the assignee after creating an assigned item', async () => {
      repo.createWorkItem.mockResolvedValue(mockItem({ id: 'wi-new', assigned_to: 'u2' }));

      await service.create('u1', 'p1', { type: 'TASK', title: 'Chore', assignedTo: 'u2' });

      expect(notifications.notifyAssigned).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: 'u2', workItemId: 'wi-new', key: 'P1-7' }),
      );
    });
  });

  describe('update — hierarchy validation', () => {
    it('rejects setting self as parent', async () => {
      await givenItems([mockItem({ id: 'wi-1' })]);

      await expect(
        service.update('u1', 'wi-1', { parentId: 'wi-1' }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.updateWorkItem).not.toHaveBeenCalled();
    });

    it('rejects a parent chain that cycles back to the item', async () => {
      await givenItems([
        mockItem({ id: 'wi-1' }),
        mockItem({ id: 'wi-2', type: 'EPIC' }),
        mockItem({ id: 'wi-3', type: 'FEATURE', parent_id: 'wi-1' }),
      ]);

      await expect(
        service.update('u1', 'wi-1', { parentId: 'wi-2' }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.updateWorkItem).not.toHaveBeenCalled();
    });

    it('rejects a type change that breaks the existing parent relationship', async () => {
      const item = mockItem({ id: 'wi-1', type: 'STORY', parent_id: 'feature-1' });
      await givenItems([item, mockItem({ id: 'feature-1', type: 'FEATURE', project_id: 'p1' })]);
      repo.updateWorkItem.mockResolvedValue(mockItem({ type: 'BUG' }));

      // BUG may only live under STORY — changing the item to BUG with a FEATURE
      // parent must be refused.
      await expect(service.update('u1', 'wi-1', { type: 'BUG' })).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.updateWorkItem).not.toHaveBeenCalled();
    });

    it('accepts a valid parent link on update and notifies watchers', async () => {
      const item = mockItem({ id: 'wi-1', type: 'TASK' });
      await givenItems([
        item,
        mockItem({ id: 'story-1', type: 'STORY', project_id: 'p1', assigned_to: 'u9' }),
        mockItem({ id: 'story-2', type: 'FEATURE', project_id: 'p1' }),
      ]);
      repo.updateWorkItem.mockResolvedValue(mockItem({ id: 'wi-1', parent_id: 'story-1' }));

      await service.update('u1', 'wi-1', { parentId: 'story-1' });

      expect(repo.updateWorkItem).toHaveBeenCalledWith('wi-1', 'u1', { parentId: 'story-1' });
      expect(notifications.notifyParentChanged).toHaveBeenCalledWith(
        expect.objectContaining({ newParentId: 'story-1', newParentAssignedTo: 'u9' }),
      );
    });
  });

  describe('update — assignment vs edit permission', () => {
    it('requires WORK_ITEM_ASSIGN when only assignedTo changes', async () => {
      await givenItems([mockItem({ id: 'wi-1', assigned_to: null })]);

      await service.update('u1', 'wi-1', { assignedTo: 'u2' });

      expect(authz.requireProjectPermission).toHaveBeenCalledWith('p1', 'u1', Permission.WORK_ITEM_ASSIGN);
    });

    it('requires WORK_ITEM_EDIT when other fields are updated at the same time', async () => {
      await givenItems([mockItem({ id: 'wi-1' })]);

      await service.update('u1', 'wi-1', { assignedTo: 'u2', title: 'Renamed' });

      expect(authz.requireProjectPermission).toHaveBeenCalledWith('p1', 'u1', Permission.WORK_ITEM_EDIT);
    });

    it('requires WORK_ITEM_EDIT for a title-only update', async () => {
      await givenItems([mockItem({ id: 'wi-1' })]);

      await service.update('u1', 'wi-1', { title: 'Renamed' });

      expect(authz.requireProjectPermission).toHaveBeenCalledWith('p1', 'u1', Permission.WORK_ITEM_EDIT);
    });

    it('rejects reassignment without WORK_ITEM_ASSIGN even when WORK_ITEM_EDIT is held', async () => {
      await givenItems([mockItem({ id: 'wi-1', assigned_to: null })]);
      authz.requireProjectPermission.mockImplementation(async (_p: string, _u: string, permission: Permission) => {
        if (permission === Permission.WORK_ITEM_ASSIGN) throw new ForbiddenException();
        return { role: 'ADMIN' };
      });

      await expect(service.update('u1', 'wi-1', { assignedTo: 'u2' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.updateWorkItem).not.toHaveBeenCalled();
    });

    it('notifies only when the assignee actually changed', async () => {
      await givenItems([mockItem({ id: 'wi-1', assigned_to: 'u2' })]);
      repo.updateWorkItem.mockResolvedValue(mockItem({ id: 'wi-1', assigned_to: 'u2' }));

      await service.update('u1', 'wi-1', { assignedTo: 'u2' });

      expect(notifications.notifyAssigned).not.toHaveBeenCalled();
    });
  });

  describe('update — state via update endpoint', () => {
    it('rejects setting state through the generic update endpoint', async () => {
      await givenItems([mockItem({ id: 'wi-1' })]);

      await expect(
        service.update('u1', 'wi-1', { state: 'IN_PROGRESS' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(repo.updateWorkItem).not.toHaveBeenCalled();
    });
  });

  describe('update — cross-project guards', () => {
    it('rejects assigning an iteration from another project', async () => {
      await givenItems([mockItem({ id: 'wi-1' })]);
      repo.getIterationProjectId.mockResolvedValue('p2');

      await expect(
        service.update('u1', 'wi-1', { iterationId: 'iter-2' }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.updateWorkItem).not.toHaveBeenCalled();
    });

    it('rejects assigning an unknown iteration', async () => {
      await givenItems([mockItem({ id: 'wi-1' })]);
      repo.getIterationProjectId.mockResolvedValue(null);

      await expect(
        service.update('u1', 'wi-1', { iterationId: 'ghost' }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.updateWorkItem).not.toHaveBeenCalled();
    });

    it('rejects assigning an area from another project', async () => {
      await givenItems([mockItem({ id: 'wi-1' })]);
      repo.getAreaProjectId.mockResolvedValue('p2');

      await expect(service.update('u1', 'wi-1', { areaId: 'area-2' })).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.updateWorkItem).not.toHaveBeenCalled();
    });

    it('notifies when an item is added to a sprint', async () => {
      await givenItems([mockItem({ id: 'wi-1' })]);
      repo.getIterationProjectId.mockResolvedValue('p1');
      repo.updateWorkItem.mockResolvedValue(mockItem({ id: 'wi-1', iteration_id: 'iter-1' }));

      await service.update('u1', 'wi-1', { iterationId: 'iter-1' });

      expect(notifications.notifyAddedToSprint).toHaveBeenCalledWith(
        expect.objectContaining({ iterationId: 'iter-1' }),
      );
    });

    it('notifies when an item is removed from a sprint', async () => {
      await givenItems([mockItem({ id: 'wi-1', iteration_id: 'iter-1' })]);

      await service.update('u1', 'wi-1', { iterationId: null });

      expect(notifications.notifyRemovedFromSprint).toHaveBeenCalledWith(
        expect.objectContaining({ previousIterationId: 'iter-1' }),
      );
    });
  });

  describe('update — missing work item', () => {
    it('throws when the work item does not exist', async () => {
      await givenItems([]);

      await expect(service.update('u1', 'missing', { title: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      expect(authz.requireProjectPermission).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('rejects deletion without WORK_ITEM_DELETE', async () => {
      await givenItems([mockItem({ id: 'wi-1' })]);
      authz.requireProjectPermission.mockRejectedValue(new ForbiddenException());

      await expect(service.remove('u1', 'wi-1')).rejects.toThrow(ForbiddenException);
      expect(repo.deleteWorkItem).not.toHaveBeenCalled();
    });

    it('deletes and returns success when authorized', async () => {
      await givenItems([mockItem({ id: 'wi-1' })]);

      const result = await service.remove('u1', 'wi-1');

      expect(authz.requireProjectPermission).toHaveBeenCalledWith('p1', 'u1', Permission.WORK_ITEM_DELETE);
      expect(repo.deleteWorkItem).toHaveBeenCalledWith('wi-1', 'u1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('findAll — team scoping', () => {
    it('asserts team membership when filtering by a specific team', async () => {
      repo.getWorkItems.mockResolvedValue([]);

      await service.findAll('u1', 'p1', { teamId: 'team-1' });

      expect(teamsService.assertTeamMember).toHaveBeenCalledWith('p1', 'team-1', 'u1');
    });

    it('skips team membership when filtering by default', async () => {
      repo.getWorkItems.mockResolvedValue([]);

      await service.findAll('u1', 'p1', { teamId: 'default' });

      expect(teamsService.assertTeamMember).not.toHaveBeenCalled();
    });
  });

  describe('comments — mention detection', () => {
    it('notifies a matching member name mention', async () => {
      await givenItems([mockItem({ id: 'wi-1', title: 'Bug' })]);
      projectsService.getMembers.mockResolvedValue([
        { userId: 'u2', name: 'Bob', email: 'bob@example.com' },
        { userId: 'u4', name: 'Zoe', email: 'zoe@example.com' },
      ]);
      repo.createComment.mockResolvedValue({ id: 'c1', content: 'Hey @bob please look' });

      await service.addComment('u1', 'wi-1', 'Hey @bob please look');

      expect(notifications.notifyMentioned).toHaveBeenCalledWith(
        expect.objectContaining({
          commentId: 'c1',
          workItemId: 'wi-1',
          mentionedUserIds: expect.arrayContaining(['u2']),
        }),
      );
    });

    it('does not notify when no one is mentioned', async () => {
      await givenItems([mockItem({ id: 'wi-1', title: 'Bug' })]);
      projectsService.getMembers.mockResolvedValue([
        { userId: 'u2', name: 'Bob', email: 'bob@example.com' },
      ]);
      repo.createComment.mockResolvedValue({ id: 'c1', content: 'just a comment' });

      await service.addComment('u1', 'wi-1', 'just a comment');

      expect(notifications.notifyMentioned).not.toHaveBeenCalled();
    });
  });

  describe('findOne / getActivity', () => {
    it('derives project from the item and returns the mapped key', async () => {
      await givenItems([mockItem({ id: 'wi-1' })]);

      const result = await service.findOne('u1', 'wi-1');

      expect(authz.requireProjectPermission).toHaveBeenCalledWith('p1', 'u1', Permission.WORK_ITEM_VIEW);
      expect(result.key).toBe('P1-7');
    });

    it('throws when the work item does not exist', async () => {
      await givenItems([]);

      await expect(service.findOne('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('getActivity returns repository records for viewers', async () => {
      await givenItems([mockItem({ id: 'wi-1' })]);
      repo.getActivity.mockResolvedValue([{ action: 'CREATED' }]);

      const activity = await service.getActivity('u1', 'wi-1');

      expect(repo.getActivity).toHaveBeenCalledWith('wi-1');
      expect(activity).toEqual([{ action: 'CREATED' }]);
    });
  });
});