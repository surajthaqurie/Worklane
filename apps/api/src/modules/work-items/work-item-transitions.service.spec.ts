import { Test, TestingModule } from '@nestjs/testing';
import { WorkItemTransitionsService } from './work-item-transitions.service.js';
import { WorkItemsRepository } from './work-items.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

const PROJECT_STATES = [
  { key: 'TODO', isDone: false },
  { key: 'IN_PROGRESS', isDone: false },
  { key: 'DONE', isDone: true },
];

describe('WorkItemTransitionsService', () => {
  let service: WorkItemTransitionsService;
  let repo: any;
  let projectsService: any;
  let authz: any;

  beforeEach(async () => {
    repo = {
      getWorkItemById: vi.fn(),
      getProjectStates: vi.fn().mockResolvedValue(PROJECT_STATES),
      updateState: vi.fn(),
    };

    projectsService = {
      assertProjectMember: vi.fn(),
    };

    authz = {
      requireProjectPermission: vi.fn().mockImplementation(async (projectId, userId) => ({
        projectId,
        userId,
        role: 'ADMIN',
      })),
    };

    const notifications = {
      notifyStateChanged: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkItemTransitionsService,
        { provide: WorkItemsRepository, useValue: repo },
        { provide: ProjectsService, useValue: projectsService },
        { provide: AuthorizationService, useValue: authz },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<WorkItemTransitionsService>(WorkItemTransitionsService);
  });

  it('should allow any transition to a state defined in the project workflow', async () => {
    repo.getWorkItemById.mockResolvedValue({ id: '1', project_id: 'p1', state: 'TODO', type: 'TASK' });
    repo.updateState.mockResolvedValue({ id: '1', state: 'IN_PROGRESS' });

    const result = await service.transitionState('u1', '1', 'IN_PROGRESS');

    expect(result.state).toBe('IN_PROGRESS');
    expect(repo.updateState).toHaveBeenCalledWith('1', 'u1', 'TODO', 'IN_PROGRESS', false, undefined, undefined);
  });

  it('should derive completion from the target state isDone flag', async () => {
    repo.getWorkItemById.mockResolvedValue({ id: '1', project_id: 'p1', state: 'IN_PROGRESS', type: 'TASK' });
    repo.updateState.mockResolvedValue({ id: '1', state: 'DONE' });

    await service.transitionState('u1', '1', 'DONE');

    expect(repo.updateState).toHaveBeenCalledWith('1', 'u1', 'IN_PROGRESS', 'DONE', true, undefined, undefined);
  });

  it('should reject a target state that is not part of the project workflow', async () => {
    repo.getWorkItemById.mockResolvedValue({ id: '1', project_id: 'p1', state: 'TODO', type: 'TASK' });

    await expect(service.transitionState('u1', '1', 'Resolved')).rejects.toThrow(BadRequestException);
    expect(repo.updateState).not.toHaveBeenCalled();
  });

  it('should reject a missing work item', async () => {
    repo.getWorkItemById.mockResolvedValue(undefined);

    await expect(service.transitionState('u1', 'missing', 'DONE')).rejects.toThrow(NotFoundException);
    expect(repo.updateState).not.toHaveBeenCalled();
  });

  it('should reject unauthorized transition', async () => {
    repo.getWorkItemById.mockResolvedValue({ id: '1', project_id: 'p1', state: 'TODO', type: 'TASK' });
    authz.requireProjectPermission.mockRejectedValue(new ForbiddenException());

    await expect(service.transitionState('u1', '1', 'IN_PROGRESS')).rejects.toThrow(ForbiddenException);
    expect(repo.updateState).not.toHaveBeenCalled();
  });

  it('should prevent transitioning to the same state', async () => {
    repo.getWorkItemById.mockResolvedValue({ id: '1', project_id: 'p1', state: 'IN_PROGRESS', type: 'TASK' });

    await expect(service.transitionState('u1', '1', 'IN_PROGRESS')).rejects.toThrow(BadRequestException);
    expect(repo.updateState).not.toHaveBeenCalled();
  });

  it('should handle concurrent updates by surfacing ConflictException from repo', async () => {
    repo.getWorkItemById.mockResolvedValue({ id: '1', project_id: 'p1', state: 'TODO', type: 'TASK' });

    const { ConflictException } = await import('@nestjs/common');
    repo.updateState.mockRejectedValue(new ConflictException('Concurrent update detected'));

    await expect(service.transitionState('u1', '1', 'IN_PROGRESS')).rejects.toThrow(ConflictException);
  });
});
