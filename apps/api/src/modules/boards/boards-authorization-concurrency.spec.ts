import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { BoardsService } from './boards.service.js';
import { Permission } from '../authorization/permissions.js';

describe('Board & Backlog API Authorization & Drag/Drop Concurrency', () => {
  let boardsService: BoardsService;
  let repoMock: any;
  let projectsServiceMock: any;
  let workItemsServiceMock: any;
  let teamsServiceMock: any;
  let authzMock: any;

  beforeEach(() => {
    repoMock = {
      listByProject: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      getProjectStates: vi.fn().mockResolvedValue([{ key: 'TODO', name: 'To Do' }]),
    };
    projectsServiceMock = {};
    workItemsServiceMock = {
      findAll: vi.fn(),
    };
    teamsServiceMock = {
      assertTeamMember: vi.fn(),
    };
    authzMock = {
      requireProjectPermission: vi.fn(),
    };

    boardsService = new BoardsService(
      repoMock,
      projectsServiceMock,
      workItemsServiceMock,
      teamsServiceMock,
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
});
