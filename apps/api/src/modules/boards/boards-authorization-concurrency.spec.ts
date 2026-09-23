import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { BoardsService } from './boards.service.js';
import { Permission } from '../authorization/permissions.js';
import { WipLimitExceededException } from '../../common/exceptions/wip-limit.exception.js';

describe('Board & Backlog API Authorization & Drag/Drop Concurrency', () => {
  let boardsService: BoardsService;
  let repoMock: any;
  let projectsServiceMock: any;
  let workItemsServiceMock: any;
  let teamsServiceMock: any;
  let transitionsServiceMock: any;
  let gatewayMock: any;
  let authzMock: any;

  beforeEach(() => {
    repoMock = {
      listByProject: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      getProjectStates: vi.fn().mockResolvedValue([{ key: 'TODO', name: 'To Do' }]),
      getWorkItemForMove: vi.fn(),
      countItemsInStates: vi.fn().mockResolvedValue(0),
      listProjectMemberIds: vi.fn().mockResolvedValue([]),
    };
    projectsServiceMock = {};
    workItemsServiceMock = {
      findAll: vi.fn(),
    };
    teamsServiceMock = {
      assertTeamMember: vi.fn(),
    };
    transitionsServiceMock = {
      transitionState: vi.fn(),
    };
    gatewayMock = {
      sendToUsers: vi.fn(),
    };
    authzMock = {
      requireProjectPermission: vi.fn(),
    };

    boardsService = new BoardsService(
      repoMock,
      projectsServiceMock,
      workItemsServiceMock,
      teamsServiceMock,
      transitionsServiceMock,
      gatewayMock,
      authzMock,
    );
  });

  describe('Organization → Project → Team Authorization Chain on Boards', () => {
    it('requires BOARD_VIEW permission when listing boards', async () => {
      repoMock.listByProject.mockResolvedValue([]);
      await boardsService.listBoards('user-1', 'proj-1');

      expect(authzMock.requireProjectPermission).toHaveBeenCalledWith(
        'proj-1',
        'user-1',
        Permission.BOARD_VIEW,
      );
    });

    it('asserts team membership when listing boards for a team', async () => {
      repoMock.listByProject.mockResolvedValue([]);
      await boardsService.listBoards('user-1', 'proj-1', 'team-1');

      expect(authzMock.requireProjectPermission).toHaveBeenCalledWith(
        'proj-1',
        'user-1',
        Permission.BOARD_VIEW,
      );
      expect(teamsServiceMock.assertTeamMember).toHaveBeenCalledWith('proj-1', 'team-1', 'user-1');
    });

    it('denies access to team board if user is not a team member', async () => {
      teamsServiceMock.assertTeamMember.mockRejectedValue(
        new ForbiddenException('You do not belong to this team'),
      );

      await expect(boardsService.listBoards('user-1', 'proj-1', 'team-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('requires BOARD_MANAGE permission when creating a board', async () => {
      repoMock.create.mockResolvedValue({ id: 'b1' });
      await boardsService.createBoard('user-1', 'proj-1', { name: 'Sprint Board' });

      expect(authzMock.requireProjectPermission).toHaveBeenCalledWith(
        'proj-1',
        'user-1',
        Permission.BOARD_MANAGE,
      );
    });

    it('asserts team membership when creating a team board', async () => {
      repoMock.create.mockResolvedValue({ id: 'b1' });
      await boardsService.createBoard('user-1', 'proj-1', {
        name: 'Team Board',
        teamId: 'team-1',
      });

      expect(teamsServiceMock.assertTeamMember).toHaveBeenCalledWith('proj-1', 'team-1', 'user-1');
    });
  });

  describe('Drag/Drop Card State Transitions — Concurrency', () => {
    it('propagates expectedVersion on state transition and rejects stale versions with HTTP 409 Conflict', async () => {
      const transitionsServiceMock = {
        transitionState: vi.fn().mockImplementation(async (_u, _id, _st, expectedVersion) => {
          if (expectedVersion === 2) {
            throw new ConflictException(
              'Concurrent update detected: Work item state or version has changed since it was loaded',
            );
          }
          return { id: 'wi-1', state: 'DONE', version: 4 };
        }),
      };

      await expect(
        transitionsServiceMock.transitionState('user-1', 'wi-1', 'DONE', 2),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Board move endpoint — WIP enforcement', () => {
    const board = {
      id: 'board-1',
      projectId: 'proj-1',
      teamId: null,
      name: 'Dev Board',
      isDefault: false,
      swimlane: 'none',
      columns: [
        { id: 'col-todo', name: 'To Do', mappedStates: ['TODO'], wipLimit: null },
        { id: 'col-wip', name: 'In Review', mappedStates: ['IN_REVIEW'], wipLimit: 2 },
        { id: 'col-done', name: 'Done', mappedStates: ['DONE'], wipLimit: null },
      ],
      cardFields: {},
      filterConfig: { backlogLevel: 'STORY' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      authzMock.requireProjectPermission.mockResolvedValue({ role: 'ADMIN' });
      teamsServiceMock.assertTeamMember.mockResolvedValue(true);
      repoMock.getById.mockResolvedValue(board);
      transitionsServiceMock.transitionState.mockResolvedValue({
        id: 'wi-1',
        state: 'IN_REVIEW',
        version: 3,
      });
    });

    it('requires WORK_ITEM_CHANGE_STATE to move a card between columns', async () => {
      repoMock.getWorkItemForMove.mockResolvedValue({
        id: 'wi-1',
        project_id: 'proj-1',
        state: 'TODO',
        type: 'STORY',
        assigned_to: null,
        parent_id: null,
      });
      await boardsService.moveWorkItem('user-1', 'proj-1', 'board-1', 'wi-1', { state: 'IN_REVIEW' });

      expect(authzMock.requireProjectPermission).toHaveBeenCalledWith(
        'proj-1',
        'user-1',
        Permission.WORK_ITEM_CHANGE_STATE,
      );
    });

    it('rejects a move into a column at its WIP limit with structured feedback', async () => {
      repoMock.getWorkItemForMove.mockResolvedValue({
        id: 'wi-1',
        project_id: 'proj-1',
        state: 'TODO',
        type: 'STORY',
        assigned_to: null,
        parent_id: null,
      });
      // Two items already sitting in the In Review column (limit 2).
      repoMock.countItemsInStates.mockResolvedValue(2);

      await expect(
        boardsService.moveWorkItem('user-1', 'proj-1', 'board-1', 'wi-1', { state: 'IN_REVIEW' }),
      ).rejects.toThrow(WipLimitExceededException);

      // The transition itself must never run when the pre-check fails.
      expect(transitionsServiceMock.transitionState).not.toHaveBeenCalled();
    });

    it('lets a move proceed when the column is one below its limit', async () => {
      repoMock.getWorkItemForMove.mockResolvedValue({
        id: 'wi-1',
        project_id: 'proj-1',
        state: 'TODO',
        type: 'STORY',
        assigned_to: null,
        parent_id: null,
      });
      repoMock.countItemsInStates.mockResolvedValue(1);

      const result = await boardsService.moveWorkItem(
        'user-1',
        'proj-1',
        'board-1',
        'wi-1',
        { state: 'IN_REVIEW' },
      );
      expect(transitionsServiceMock.transitionState).toHaveBeenCalledWith(
        'user-1',
        'wi-1',
        'IN_REVIEW',
        undefined,
        expect.objectContaining({
          projectId: 'proj-1',
          columnId: 'col-wip',
          columnName: 'In Review',
          targetStates: ['IN_REVIEW'],
          limit: 2,
          excludeItemId: 'wi-1',
          typeScope: ['STORY', 'BUG', 'TASK'],
        }),
      );
      expect(result.state).toBe('IN_REVIEW');
    });

    it('does not enforce WIP for a move within the same column (same-column state change)', async () => {
      board.columns.push({
        id: 'col-wip-b',
        name: 'In Review B',
        mappedStates: ['IN_REVIEW_B'],
        wipLimit: null,
      });
      repoMock.getWorkItemForMove.mockResolvedValue({
        id: 'wi-1',
        project_id: 'proj-1',
        state: 'IN_REVIEW',
        type: 'STORY',
        assigned_to: null,
        parent_id: null,
      });
      // Column at limit, but the item is moving between states inside it.
      repoMock.countItemsInStates.mockResolvedValue(2);

      await boardsService.moveWorkItem('user-1', 'proj-1', 'board-1', 'wi-1', {
        state: 'IN_REVIEW_B',
      });

      // WIP constraint must not be attached to the transition (no count change).
      const [, , , , wipConstraint] = transitionsServiceMock.transitionState.mock.calls[0];
      expect(wipConstraint).toBeUndefined();
    });

    it('bypassWip lets a maintainer override the limit', async () => {
      repoMock.getWorkItemForMove.mockResolvedValue({
        id: 'wi-1',
        project_id: 'proj-1',
        state: 'TODO',
        type: 'STORY',
        assigned_to: null,
        parent_id: null,
      });
      repoMock.countItemsInStates.mockResolvedValue(2);

      const result = await boardsService.moveWorkItem(
        'user-1',
        'proj-1',
        'board-1',
        'wi-1',
        { state: 'IN_REVIEW', bypassWip: true },
      );
      expect(transitionsServiceMock.transitionState).toHaveBeenCalledWith(
        'user-1',
        'wi-1',
        'IN_REVIEW',
        undefined,
        undefined,
      );
      expect(result.state).toBe('IN_REVIEW');
    });

    it('broadcasts a board:item-moved event to project members except the actor', async () => {
      repoMock.getWorkItemForMove.mockResolvedValue({
        id: 'wi-1',
        project_id: 'proj-1',
        state: 'TODO',
        type: 'STORY',
        assigned_to: null,
        parent_id: null,
      });
      repoMock.listProjectMemberIds.mockResolvedValue(['user-1', 'user-2', 'user-3']);

      await boardsService.moveWorkItem('user-1', 'proj-1', 'board-1', 'wi-1', {
        state: 'IN_REVIEW',
      });

      expect(gatewayMock.sendToUsers).toHaveBeenCalledWith(
        ['user-2', 'user-3'],
        'board:item-moved',
        expect.objectContaining({
          projectId: 'proj-1',
          boardId: 'board-1',
          workItemId: 'wi-1',
          state: 'IN_REVIEW',
          actorId: 'user-1',
        }),
      );
    });
  });

  describe('Board move endpoint — team-scoped WIP', () => {
    const teamBoard = {
      id: 'board-team',
      projectId: 'proj-1',
      teamId: 'team-1',
      name: 'Team Board',
      isDefault: false,
      swimlane: 'none',
      columns: [
        { id: 'col-todo', name: 'To Do', mappedStates: ['TODO'], wipLimit: null },
        { id: 'col-wip', name: 'In Review', mappedStates: ['IN_REVIEW'], wipLimit: 2 },
        { id: 'col-done', name: 'Done', mappedStates: ['DONE'], wipLimit: null },
      ],
      cardFields: {},
      filterConfig: { backlogLevel: 'STORY' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const todoItem = {
      id: 'wi-1',
      project_id: 'proj-1',
      state: 'TODO',
      type: 'STORY',
      assigned_to: null,
      parent_id: null,
    };

    beforeEach(() => {
      authzMock.requireProjectPermission.mockResolvedValue({ role: 'ADMIN' });
      teamsServiceMock.assertTeamMember.mockResolvedValue(true);
      repoMock.getById.mockResolvedValue(teamBoard);
      repoMock.getWorkItemForMove.mockResolvedValue(todoItem);
      repoMock.countItemsInStates.mockResolvedValue(1);
      transitionsServiceMock.transitionState.mockResolvedValue({
        id: 'wi-1',
        state: 'IN_REVIEW',
        version: 3,
      });
    });

    it('counts WIP over the board team scope and passes it into the atomic constraint', async () => {
      await boardsService.moveWorkItem('user-1', 'proj-1', 'board-team', 'wi-1', {
        state: 'IN_REVIEW',
      });

      // The pre-check must count only the team's visible items — never the
      // project's whole backlog — so one team cannot be starved by another.
      expect(repoMock.countItemsInStates).toHaveBeenCalledWith(
        'proj-1',
        ['IN_REVIEW'],
        ['STORY', 'BUG', 'TASK'],
        'team-1',
      );

      const [, , , , wipConstraint] = transitionsServiceMock.transitionState.mock.calls[0];
      expect(wipConstraint).toMatchObject({
        projectId: 'proj-1',
        columnId: 'col-wip',
        teamScope: 'team-1',
      });
    });

    it('lets an explicit teamId view override the board team for WIP scoping', async () => {
      await boardsService.moveWorkItem('user-1', 'proj-1', 'board-team', 'wi-1', {
        state: 'IN_REVIEW',
        teamId: 'team-2',
      });

      // Board access asserted team-1; the move itself re-scopes WIP to team-2.
      expect(teamsServiceMock.assertTeamMember).toHaveBeenCalledWith('proj-1', 'team-2', 'user-1');
      expect(repoMock.countItemsInStates).toHaveBeenCalledWith(
        'proj-1',
        ['IN_REVIEW'],
        ['STORY', 'BUG', 'TASK'],
        'team-2',
      );
    });

    it('rejects a WIP move when the user is not a member of the view team', async () => {
      // Project-global board, but the user insists on scoping WIP to team-2.
      repoMock.getById.mockResolvedValue({ ...teamBoard, teamId: null });
      teamsServiceMock.assertTeamMember.mockRejectedValue(
        new ForbiddenException('You do not belong to this team'),
      );

      await expect(
        boardsService.moveWorkItem('user-1', 'proj-1', 'board-team', 'wi-1', {
          state: 'IN_REVIEW',
          teamId: 'team-2',
        }),
      ).rejects.toThrow(ForbiddenException);

      // Never starts the pre-check or the transition.
      expect(repoMock.countItemsInStates).not.toHaveBeenCalled();
      expect(transitionsServiceMock.transitionState).not.toHaveBeenCalled();
    });
  });

  describe('Board swimlanes', () => {
    it('defaults a created board to the `none` swimlane and persists a chosen mode', async () => {
      repoMock.create.mockResolvedValue({ id: 'b1', swimlane: 'epic' });
      repoMock.getProjectStates.mockResolvedValue([
        { id: '1', key: 'TODO', name: 'To Do' },
        { id: '2', key: 'DONE', name: 'Done' },
      ]);

      await boardsService.createBoard('user-1', 'proj-1', { name: 'Epic Board', swimlane: 'epic' });
      expect(repoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ swimlane: 'epic' }),
      );

      await boardsService.createBoard('user-1', 'proj-1', { name: 'No Swimlane Board' });
      const defaultCall = repoMock.create.mock.calls.find(
        (c: any[]) => c[0].name === 'No Swimlane Board',
      );
      expect(defaultCall[0]).toEqual(expect.objectContaining({ swimlane: 'none' }));
    });

    it('rejects an unknown swimlane mode on create', async () => {
      await expect(
        boardsService.createBoard('user-1', 'proj-1', {
          name: 'Bad Swimlane',
          swimlane: 'galaxy' as any,
        }),
      ).rejects.toThrow();
      expect(repoMock.create).not.toHaveBeenCalled();
    });

    it('updates the swimlane on an existing board', async () => {
      repoMock.getById.mockResolvedValue({
        id: 'b1',
        projectId: 'proj-1',
        teamId: null,
        name: 'Board',
        isDefault: false,
        swimlane: 'none',
        columns: [{ id: 'c1', name: 'To Do', mappedStates: ['TODO'], wipLimit: null }],
        cardFields: {},
        filterConfig: {},
      });
      repoMock.update.mockResolvedValue({ id: 'b1', swimlane: 'assignee' });

      await boardsService.updateBoard('user-1', 'proj-1', 'b1', { swimlane: 'assignee' });
      expect(repoMock.update).toHaveBeenCalledWith(
        'b1',
        expect.objectContaining({ swimlane: 'assignee' }),
      );

      // Config changes are broadcast to other connected members.
      await boardsService.updateBoard('user-1', 'proj-1', 'b1', { swimlane: 'none' });
      expect(gatewayMock.sendToUsers).toHaveBeenCalledWith(
        expect.any(Array),
        'board:updated',
        expect.objectContaining({ boardId: 'b1', action: 'updated' }),
      );
    });
  });
});
