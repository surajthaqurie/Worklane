import { Test, TestingModule } from '@nestjs/testing';
import { WorkItemsService } from './work-items.service.js';
import { WorkItemsRepository } from './work-items.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { TeamsService } from '../teams/teams.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { WorkItemTypeRegistryService } from './work-item-types.registry.js';
import { BadRequestException } from '@nestjs/common';

describe('WorkItemsService - Phase 11 Fields and Validation', () => {
  let service: WorkItemsService;
  let repo: any;
  let authz: any;

  beforeEach(async () => {
    repo = {
      createWorkItem: vi.fn().mockResolvedValue({
        id: 'wi-1',
        project_id: 'p-1',
        seq_no: 1,
        type: 'STORY',
        title: 'Test Story',
        description: null,
        state: 'TODO',
        priority: 'MEDIUM',
        severity: 'HIGH',
        remaining_work: 5,
        completed_work: 2,
        start_date: new Date('2026-09-01'),
        target_date: new Date('2026-09-10'),
        custom_fields: { component: 'Auth' },
        assigned_to: null,
        created_by: 'u-1',
        created_at: new Date(),
        updated_at: new Date(),
      }),
      getWorkItemById: vi.fn(),
      updateWorkItem: vi.fn(),
    };

    authz = {
      requireProjectPermissionWithProject: vi.fn().mockResolvedValue({
        project: { id: 'p-1', key: 'PROJ' },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkItemsService,
        WorkItemTypeRegistryService,
        { provide: WorkItemsRepository, useValue: repo },
        { provide: ProjectsService, useValue: {} },
        { provide: TeamsService, useValue: {} },
        { provide: AuthorizationService, useValue: authz },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();

    service = module.get<WorkItemsService>(WorkItemsService);
  });

  it('successfully creates work item with valid severity, remainingWork, completedWork, and dates', async () => {
    const result = await service.create('u-1', 'p-1', {
      type: 'STORY',
      title: 'Valid Story',
      severity: 'HIGH',
      remainingWork: 5,
      completedWork: 2,
      startDate: '2026-09-01T00:00:00.000Z',
      targetDate: '2026-09-10T00:00:00.000Z',
      customFields: { component: 'Auth' },
    });

    expect(result.severity).toBe('HIGH');
    expect(result.remainingWork).toBe(5);
    expect(result.completedWork).toBe(2);
    expect(repo.createWorkItem).toHaveBeenCalled();
  });

  it('rejects work item creation with invalid severity level', async () => {
    await expect(
      service.create('u-1', 'p-1', {
        type: 'STORY',
        title: 'Invalid Severity',
        severity: 'SUPER_HIGH' as any,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects work item creation with negative remaining work', async () => {
    await expect(
      service.create('u-1', 'p-1', {
        type: 'STORY',
        title: 'Negative Work',
        remainingWork: -10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects work item creation with target date earlier than start date', async () => {
    await expect(
      service.create('u-1', 'p-1', {
        type: 'STORY',
        title: 'Bad Dates',
        startDate: '2026-09-20',
        targetDate: '2026-09-10',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects unregistered work item type', async () => {
    await expect(
      service.create('u-1', 'p-1', {
        type: 'INVALID_TYPE' as any,
        title: 'Bad Type',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
