import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QueriesService } from './queries.service.js';
import { QueriesRepository } from './queries.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';

const VALID_DEFINITION = {
  filters: [{ logicalOperator: 'AND', field: 'state', operator: 'equals', value: 'In Progress' }],
  sortBy: 'key',
  sortOrder: 'asc',
};

function mockQuery(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q1',
    projectId: 'p1',
    name: 'My query',
    description: null,
    isShared: false,
    createdBy: 'u1',
    folder: null,
    definition: VALID_DEFINITION,
    ...overrides,
  };
}

describe('QueriesService', () => {
  let service: QueriesService;
  let repo: any;
  let projectsService: any;
  let authz: any;
  let membershipRole: string;

  beforeEach(async () => {
    membershipRole = 'ADMIN';
    repo = {
      findAllByProject: vi.fn().mockResolvedValue([]),
      findRecent: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      create: vi.fn().mockResolvedValue(mockQuery()),
      update: vi.fn().mockResolvedValue(mockQuery()),
      remove: vi.fn(),
      recordRun: vi.fn(),
      execute: vi.fn().mockResolvedValue([]),
    };

    projectsService = {
      assertProjectMember: vi.fn().mockResolvedValue({ id: 'p1', key: 'P1' }),
    };

    authz = {
      requireProjectPermission: vi.fn(
        async (projectId: string, userId: string) => ({ projectId, userId, role: membershipRole }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueriesService,
        { provide: QueriesRepository, useValue: repo },
        { provide: ProjectsService, useValue: projectsService },
        { provide: AuthorizationService, useValue: authz },
      ],
    }).compile();

    service = module.get<QueriesService>(QueriesService);
  });

  describe('findAll / recent', () => {
    it('lists queries with QUERY_VIEW', async () => {
      await service.findAll('u1', 'p1');
      expect(authz.requireProjectPermission).toHaveBeenCalledWith('p1', 'u1', Permission.QUERY_VIEW);
      expect(repo.findAllByProject).toHaveBeenCalledWith('p1');
    });

    it('lists recent queries for the user', async () => {
      await service.recent('u1', 'p1');
      expect(repo.findRecent).toHaveBeenCalledWith('p1', 'u1');
    });
  });

  describe('findOne — project scoping', () => {
    it('rejects a query that was fetched but belongs to a different project', async () => {
      repo.findOne.mockResolvedValue(mockQuery({ projectId: 'p2' }));

      await expect(service.findOne('u1', 'p1', 'q1')).rejects.toThrow(NotFoundException);
      expect(repo.findOne).toHaveBeenCalledWith('q1');
    });

    it('rejects a missing query', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('u1', 'p1', 'q1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('validates, authorizes, then persists a valid definition', async () => {
      await service.create('u1', 'p1', {
        name: 'In progress',
        definition: VALID_DEFINITION,
      });

      expect(authz.requireProjectPermission).toHaveBeenCalledWith('p1', 'u1', Permission.QUERY_CREATE);
      expect(repo.create).toHaveBeenCalledWith(
        'p1',
        'u1',
        expect.objectContaining({
          name: 'In progress',
          definition: expect.objectContaining({ filters: VALID_DEFINITION.filters }),
        }),
      );
    });

    it('rejects a payload that fails schema validation', async () => {
      await expect(service.create('u1', 'p1', { name: '' })).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects a definition that fails semantic validation', async () => {
      await expect(
        service.create('u1', 'p1', {
          name: 'Broken',
          definition: {
            filters: [{ logicalOperator: 'AND', field: 'createdAt', operator: 'contains', value: 'x' }],
          },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects creating without QUERY_CREATE', async () => {
      authz.requireProjectPermission.mockRejectedValue(new ForbiddenException());

      await expect(
        service.create('u1', 'p1', { name: 'X', definition: VALID_DEFINITION }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('allows a member to edit a shared query with QUERY_EDIT', async () => {
      repo.findOne.mockResolvedValue(mockQuery({ isShared: true, createdBy: 'u9' }));

      await service.update('u1', 'p1', 'q1', { name: 'Renamed', definition: VALID_DEFINITION });

      expect(authz.requireProjectPermission).toHaveBeenCalledWith('p1', 'u1', Permission.QUERY_EDIT);
      expect(repo.update).toHaveBeenCalledWith(
        'q1',
        expect.objectContaining({
          name: 'Renamed',
          definition: expect.objectContaining({ filters: VALID_DEFINITION.filters }),
        }),
      );
    });

    it('forbids editing someone else personal query', async () => {
      repo.findOne.mockResolvedValue(mockQuery({ isShared: false, createdBy: 'u9' }));

      await expect(
        service.update('u1', 'p1', 'q1', { name: 'Renamed', definition: VALID_DEFINITION }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('rejects an invalid updated definition before hitting the repo', async () => {
      repo.findOne.mockResolvedValue(mockQuery({ isShared: true, createdBy: 'u9' }));

      await expect(
        service.update('u1', 'p1', 'q1', {
          definition: { filters: [{ logicalOperator: 'AND', field: 'dropTable', operator: 'equals', value: 'x' }] },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('forbids deleting someone else personal query', async () => {
      repo.findOne.mockResolvedValue(mockQuery({ isShared: false, createdBy: 'u9' }));

      await expect(service.remove('u1', 'p1', 'q1')).rejects.toThrow(ForbiddenException);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('forbids a MEMBER from deleting a shared query created by others', async () => {
      membershipRole = 'MEMBER';
      repo.findOne.mockResolvedValue(mockQuery({ isShared: true, createdBy: 'u9' }));

      await expect(service.remove('u1', 'p1', 'q1')).rejects.toThrow(ForbiddenException);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('allows a MEMBER to delete their own shared query', async () => {
      membershipRole = 'MEMBER';
      repo.findOne.mockResolvedValue(mockQuery({ isShared: true, createdBy: 'u1' }));

      await service.remove('u1', 'p1', 'q1');

      expect(repo.remove).toHaveBeenCalledWith('q1');
    });

    it('allows an ADMIN to delete a shared query created by others', async () => {
      repo.findOne.mockResolvedValue(mockQuery({ isShared: true, createdBy: 'u9' }));

      await service.remove('u1', 'p1', 'q1');

      expect(repo.remove).toHaveBeenCalledWith('q1');
    });
  });

  describe('runSaved', () => {
    it('executes the saved definition and records the run with the query id', async () => {
      repo.findOne.mockResolvedValue(mockQuery({ isShared: true }));
      repo.execute.mockResolvedValue([{ id: 'wi-1' }]);

      const rows = await service.runSaved('u1', 'p1', 'q1');

      expect(authz.requireProjectPermission).toHaveBeenCalledWith('p1', 'u1', Permission.QUERY_VIEW);
      expect(repo.execute).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ filters: VALID_DEFINITION.filters }),
        'u1',
        'P1',
      );
      expect(repo.recordRun).toHaveBeenCalledWith(
        'p1',
        'q1',
        'u1',
        expect.objectContaining({ filters: VALID_DEFINITION.filters }),
      );
      expect(rows).toEqual([{ id: 'wi-1' }]);
    });

    it('rejects a tampered stored definition instead of executing it', async () => {
      repo.findOne.mockResolvedValue(
        mockQuery({
          isShared: true,
          definition: { filters: [{ logicalOperator: 'AND', field: 'dropTable', operator: 'equals', value: 'x' }] },
        }),
      );

      await expect(service.runSaved('u1', 'p1', 'q1')).rejects.toThrow(BadRequestException);
      expect(repo.execute).not.toHaveBeenCalled();
      expect(repo.recordRun).not.toHaveBeenCalled();
    });

    it('rejects running without QUERY_VIEW', async () => {
      repo.findOne.mockResolvedValue(mockQuery({ isShared: true }));
      authz.requireProjectPermission.mockRejectedValue(new ForbiddenException());

      await expect(service.runSaved('u1', 'p1', 'q1')).rejects.toThrow(ForbiddenException);
      expect(repo.execute).not.toHaveBeenCalled();
    });
  });

  describe('runAdhoc', () => {
    it('defaults to an empty definition when none is given', async () => {
      const rows = await service.runAdhoc('u1', 'p1', undefined);

      expect(repo.execute).toHaveBeenCalledWith('p1', expect.objectContaining({ filters: [] }), 'u1', 'P1');
      expect(repo.recordRun).toHaveBeenCalledWith('p1', null, 'u1', expect.objectContaining({ filters: [] }));
      expect(rows).toEqual([]);
    });

    it('rejects an ad-hoc definition with an unsupported operator', async () => {
      await expect(
        service.runAdhoc('u1', 'p1', {
          filters: [{ logicalOperator: 'AND', field: 'createdAt', operator: 'contains', value: 'foo' }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.execute).not.toHaveBeenCalled();
    });

    it('asserts project membership as the query data scope', async () => {
      await service.runAdhoc('u1', 'p1', {
        filters: [{ logicalOperator: 'AND', field: 'state', operator: 'equals', value: 'TODO' }],
      });

      expect(projectsService.assertProjectMember).toHaveBeenCalledWith('p1', 'u1');
    });
  });
});