import { Test, TestingModule } from '@nestjs/testing';
import { WorkItemTransitionsService } from './work-item-transitions.service.js';
import { WorkItemsRepository } from './work-items.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('WorkItemTransitionsService', () => {
  let service: WorkItemTransitionsService;
  let repo: any;
  let projectsService: any;

  beforeEach(async () => {
    repo = {
      getWorkItemById: vi.fn(),
      updateState: vi.fn(),
    };

    projectsService = {
      assertProjectMember: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkItemTransitionsService,
        { provide: WorkItemsRepository, useValue: repo },
        { provide: ProjectsService, useValue: projectsService },
      ],
    }).compile();

    service = module.get<WorkItemTransitionsService>(WorkItemTransitionsService);
  });

  it('should allow valid transition', async () => {
    repo.getWorkItemById.mockResolvedValue({ id: '1', project_id: 'p1', state: 'New', type: 'TASK' });
    projectsService.assertProjectMember.mockResolvedValue(true);
    repo.updateState.mockResolvedValue({ id: '1', state: 'Active' });

    const result = await service.transitionState('u1', '1', 'Active');
    expect(result.state).toBe('Active');
    expect(repo.updateState).toHaveBeenCalledWith('1', 'u1', 'New', 'Active');
  });

  it('should reject invalid transition', async () => {
    repo.getWorkItemById.mockResolvedValue({ id: '1', project_id: 'p1', state: 'New', type: 'TASK' });
    projectsService.assertProjectMember.mockResolvedValue(true);

    await expect(service.transitionState('u1', '1', 'Resolved')).rejects.toThrow(BadRequestException);
    expect(repo.updateState).not.toHaveBeenCalled();
  });

  it('should reject unauthorized transition', async () => {
    repo.getWorkItemById.mockResolvedValue({ id: '1', project_id: 'p1', state: 'New', type: 'TASK' });
    projectsService.assertProjectMember.mockRejectedValue(new ForbiddenException());

    await expect(service.transitionState('u1', '1', 'Active')).rejects.toThrow(ForbiddenException);
    expect(repo.updateState).not.toHaveBeenCalled();
  });

  it('should reject already closed item if trying to transition to something not allowed', async () => {
    // Current Closed -> Active is allowed. Closed -> Resolved is not.
    repo.getWorkItemById.mockResolvedValue({ id: '1', project_id: 'p1', state: 'Closed', type: 'TASK' });
    projectsService.assertProjectMember.mockResolvedValue(true);

    await expect(service.transitionState('u1', '1', 'Resolved')).rejects.toThrow(BadRequestException);
  });

  it('should allow reopening item', async () => {
    // Current Closed -> Active is allowed.
    repo.getWorkItemById.mockResolvedValue({ id: '1', project_id: 'p1', state: 'Closed', type: 'TASK' });
    projectsService.assertProjectMember.mockResolvedValue(true);
    repo.updateState.mockResolvedValue({ id: '1', state: 'Active' });

    const result = await service.transitionState('u1', '1', 'Active');
    expect(result.state).toBe('Active');
  });

  it('should prevent transitioning to the same state', async () => {
    repo.getWorkItemById.mockResolvedValue({ id: '1', project_id: 'p1', state: 'Active', type: 'TASK' });
    projectsService.assertProjectMember.mockResolvedValue(true);

    await expect(service.transitionState('u1', '1', 'Active')).rejects.toThrow(BadRequestException);
    expect(repo.updateState).not.toHaveBeenCalled();
  });

  it('should handle concurrent updates by surfacing ConflictException from repo', async () => {
    repo.getWorkItemById.mockResolvedValue({ id: '1', project_id: 'p1', state: 'New', type: 'TASK' });
    projectsService.assertProjectMember.mockResolvedValue(true);
    
    // Simulate repository throwing a ConflictException due to optimistic concurrency check failure
    const { ConflictException } = await import('@nestjs/common');
    repo.updateState.mockRejectedValue(new ConflictException('Concurrent update detected'));

    await expect(service.transitionState('u1', '1', 'Active')).rejects.toThrow(ConflictException);
  });
});
