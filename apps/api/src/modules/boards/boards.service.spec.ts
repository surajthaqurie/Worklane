import { Test, TestingModule } from '@nestjs/testing';
import { BoardsService } from './boards.service.js';
import { BoardsRepository } from './boards.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { WorkItemsService } from '../work-items/work-items.service.js';
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardsService,
        { provide: BoardsRepository, useValue: repo },
        { provide: ProjectsService, useValue: projectsService },
        { provide: WorkItemsService, useValue: workItemsService },
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
      ],
      cardFields: { showType: true },
      filterConfig: { backlogLevel: 'STORY' },
    });

    const result = await service.createBoard('u1', 'p1', {
      name: 'Dev Board',
      columns: [
        { id: 'col-1', name: 'Planned', mappedStates: ['TODO'], wipLimit: 10 },
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
});
