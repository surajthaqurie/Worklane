import { Test, TestingModule } from '@nestjs/testing';
import { BoardsService } from './boards.service.js';
import { BoardsRepository } from './boards.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { WorkItemsService } from '../work-items/work-items.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('BoardsService', () => {
  let service: BoardsService;
  let repo: any;
  let projectsService: any;
  let workItemsService: any;

  const mockProjectStates = [
    { id: '1', key: 'TODO', name: 'To Do', color: '#94A3B8', sortOrder: 0, isDone: false },
    { id: '2', key: 'IN_PROGRESS', name: 'In Progress', color: '#3B82F6', sortOrder: 1, isDone: false },
    { id: '3', key: 'DONE', name: 'Done', color: '#22C55E', sortOrder: 2, isDone: true },
  ];

  beforeEach(async () => {
    repo = {
      listByProject: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      getProjectStates: vi.fn().mockResolvedValue(mockProjectStates),
    };

    projectsService = {
      assertProjectMember: vi.fn().mockResolvedValue(true),
    };

    workItemsService = {
      findAll: vi.fn().mockResolvedValue([]),
    };

    const authz = {
      requireProjectPermission: vi.fn().mockResolvedValue({ role: 'OWNER' }),
      requireProjectPermissionWithProject: vi.fn().mockResolvedValue({
        project: { id: 'p1', key: 'P' },
        membership: { role: 'OWNER' },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardsService,
        { provide: BoardsRepository, useValue: repo },
        { provide: ProjectsService, useValue: projectsService },
        { provide: WorkItemsService, useValue: workItemsService },
        { provide: AuthorizationService, useValue: authz },
      ],
    }).compile();

    service = module.get<BoardsService>(BoardsService);
  });

  it('should list boards and auto-seed a default board if none exist', async () => {
    repo.listByProject.mockResolvedValue([]);
    repo.create.mockResolvedValue({
      id: 'b1',
      projectId: 'p1',
      name: 'Main Board',
      columns: [
        { id: 'col-todo', name: 'To Do', mappedStates: ['TODO'], wipLimit: null },
      ],
      isDefault: true,
    });

    const result = await service.listBoards('u1', 'p1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Main Board');
    expect(repo.create).toHaveBeenCalled();
  });

  it('should create a custom board with valid column and state mappings', async () => {
    repo.create.mockResolvedValue({
      id: 'b2',
      projectId: 'p1',
      name: 'Dev Board',
      columns: [
        { id: 'col-1', name: 'Planned', mappedStates: ['TODO'], wipLimit: 10 },
        { id: 'col-2', name: 'In Dev', mappedStates: ['IN_PROGRESS'], wipLimit: 5 },
        { id: 'col-3', name: 'Shipped', mappedStates: ['DONE'], wipLimit: null },
      ],
      cardFields: { showType: true },
      filterConfig: { backlogLevel: 'STORY' },
    });

    const result = await service.createBoard('u1', 'p1', {
      name: 'Dev Board',
      columns: [
        { id: 'col-1', name: 'Planned', mappedStates: ['TODO'], wipLimit: 10 },
        { id: 'col-2', name: 'In Dev', mappedStates: ['IN_PROGRESS'], wipLimit: 5 },
        { id: 'col-3', name: 'Shipped', mappedStates: ['DONE'], wipLimit: null },
      ],
    });

    expect(result.id).toBe('b2');
    expect(result.name).toBe('Dev Board');
  });

  it('should reject creating a board with an empty column list', async () => {
    await expect(
      service.createBoard('u1', 'p1', {
        name: 'Empty Board',
        columns: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject creating a board with mapped states that do not exist in project workflow', async () => {
    await expect(
      service.createBoard('u1', 'p1', {
        name: 'Invalid Board',
        columns: [
          { id: 'col-1', name: 'Unknown', mappedStates: ['NON_EXISTENT_STATE'] },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject board columns that leave a workflow state unmapped', async () => {
    await expect(
      service.createBoard('u1', 'p1', {
        name: 'Incomplete Board',
        columns: [
          { id: 'col-1', name: 'To Do', mappedStates: ['TODO'] },
          { id: 'col-2', name: 'In Progress', mappedStates: ['IN_PROGRESS'] },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject a workflow state mapped to more than one column', async () => {
    await expect(
      service.createBoard('u1', 'p1', {
        name: 'Duplicate Board',
        columns: [
          { id: 'col-1', name: 'To Do', mappedStates: ['TODO', 'IN_PROGRESS'] },
          { id: 'col-2', name: 'Also In Progress', mappedStates: ['IN_PROGRESS'] },
          { id: 'col-3', name: 'Done', mappedStates: ['DONE'] },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject column with negative WIP limit', async () => {
    await expect(
      service.createBoard('u1', 'p1', {
        name: 'Invalid WIP',
        columns: [
          { id: 'col-1', name: 'In Dev', mappedStates: ['IN_PROGRESS'], wipLimit: -3 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should update board configuration without modifying work-item states', async () => {
    repo.getById.mockResolvedValue({
      id: 'b1',
      projectId: 'p1',
      name: 'Main Board',
      columns: [
        { id: 'col-1', name: 'To Do', mappedStates: ['TODO'] },
      ],
      cardFields: {},
      filterConfig: {},
    });

    repo.update.mockResolvedValue({
      id: 'b1',
      projectId: 'p1',
      name: 'Updated Board',
      columns: [
        { id: 'col-1', name: 'Backlog', mappedStates: ['TODO'], wipLimit: 5 },
      ],
    });

    const updated = await service.updateBoard('u1', 'p1', 'b1', {
      name: 'Updated Board',
      columns: [
        { id: 'col-1', name: 'Backlog', mappedStates: ['TODO'], wipLimit: 5 },
        { id: 'col-2', name: 'In Dev', mappedStates: ['IN_PROGRESS'], wipLimit: 3 },
        { id: 'col-3', name: 'Shipped', mappedStates: ['DONE'], wipLimit: null },
      ],
    });

    expect(updated.name).toBe('Updated Board');
    expect(repo.update).toHaveBeenCalledWith('b1', expect.objectContaining({
      name: 'Updated Board',
    }));
  });

  it('should prevent deleting the last board in a project', async () => {
    repo.getById.mockResolvedValue({ id: 'b1', projectId: 'p1' });
    repo.listByProject.mockResolvedValue([{ id: 'b1' }]);

    await expect(service.deleteBoard('u1', 'p1', 'b1')).rejects.toThrow(BadRequestException);
  });

  describe('getBoard — default alias', () => {
    const board: any = {
      id: 'b1',
      projectId: 'p1',
      teamId: 'team-1',
      name: 'Main Board',
      filterConfig: { backlogLevel: 'STORY' },
    };

    it('resolves the "default" alias to the first listed board', async () => {
      repo.listByProject.mockResolvedValue([board]);

      const result = await service.getBoard('u1', 'p1', 'default');

      expect(result.id).toBe('b1');
      expect(repo.getById).not.toHaveBeenCalled();
    });

    it('throws NotFound when the board does not exist', async () => {
      repo.getById.mockResolvedValue(undefined);

      await expect(service.getBoard('u1', 'p1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBoardWorkItems — filter merging', () => {
    const board: any = {
      id: 'b1',
      projectId: 'p1',
      teamId: 'team-1',
      filterConfig: {
        backlogLevel: 'STORY',
        assignedTo: 'u-fixed',
        areaId: 'area-fixed',
        tags: 'bug,ui',
        iterationId: 'iter-fixed',
        search: 'board-default-search',
      },
    };

    it('passes the board filter config through to the work item query', async () => {
      repo.getById.mockResolvedValue(board);
      workItemsService.findAll.mockResolvedValue([{ id: 'wi-1' }]);

      const result = await service.getBoardWorkItems('u1', 'p1', 'b1');

      expect(workItemsService.findAll).toHaveBeenCalledWith(
        'u1',
        'p1',
        expect.objectContaining({
          backlogLevel: 'STORY',
          assignedTo: 'u-fixed',
          areaId: 'area-fixed',
          tags: 'bug,ui',
          iterationId: 'iter-fixed',
          search: 'board-default-search',
          teamId: 'team-1',
        }),
      );
      expect(result).toEqual([{ id: 'wi-1' }]);
    });

    it('lets explicit query filters override the board config', async () => {
      repo.getById.mockResolvedValue(board);
      workItemsService.findAll.mockResolvedValue([]);

      await service.getBoardWorkItems('u1', 'p1', 'b1', {
        assignedTo: 'u-query',
        areaId: 'area-query',
        iterationId: 'iter-query',
        tags: 'hot',
        search: 'query-search',
        teamId: 'team-2',
      });

      expect(workItemsService.findAll).toHaveBeenCalledWith(
        'u1',
        'p1',
        expect.objectContaining({
          assignedTo: 'u-query',
          areaId: 'area-query',
          iterationId: 'iter-query',
          tags: 'hot',
          search: 'query-search',
          teamId: 'team-2',
        }),
      );
    });

    it('falls back to the board team when no team filter is supplied', async () => {
      repo.getById.mockResolvedValue(board);
      workItemsService.findAll.mockResolvedValue([]);

      await service.getBoardWorkItems('u1', 'p1', 'b1', { search: 'only-search' });

      expect(workItemsService.findAll).toHaveBeenCalledWith(
        'u1',
        'p1',
        expect.objectContaining({ teamId: 'team-1', search: 'only-search' }),
      );
    });

    it('resolves the default board alias through listBoards and merges its config', async () => {
      repo.listByProject.mockResolvedValue([board]);
      workItemsService.findAll.mockResolvedValue([]);

      await service.getBoardWorkItems('u1', 'p1', 'default');

      // listByProject returned boards, so no auto-seed happens.
      expect(repo.create).not.toHaveBeenCalled();
      expect(workItemsService.findAll).toHaveBeenCalledWith(
        'u1',
        'p1',
        expect.objectContaining({ backlogLevel: 'STORY', teamId: 'team-1' }),
      );
    });

    it('seeds and uses a default board when the project has none', async () => {
      repo.listByProject.mockResolvedValue([]);
      repo.create.mockResolvedValue({
        id: 'seed-1',
        projectId: 'p1',
        name: 'Main Board',
        teamId: null,
        filterConfig: { backlogLevel: 'STORY' },
      });
      workItemsService.findAll.mockResolvedValue([]);

      await service.getBoardWorkItems('u1', 'p1', 'default');

      expect(repo.create).toHaveBeenCalled();
      expect(workItemsService.findAll).toHaveBeenCalledWith(
        'u1',
        'p1',
        expect.objectContaining({ backlogLevel: 'STORY' }),
      );
    });
  });
});
