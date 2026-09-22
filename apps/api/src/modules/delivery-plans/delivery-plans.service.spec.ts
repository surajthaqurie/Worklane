import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DeliveryPlansService } from './delivery-plans.service.js';
import { DeliveryPlansRepository } from './delivery-plans.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';

// Valid RFC 4122 UUIDs so the zod payload schemas pass (they enforce uuid()).
const TEAM_1 = '550e8400-e29b-41d4-a716-446655440001';
const TEAM_2 = '550e8400-e29b-41d4-a716-446655440002';
const ITEM_1 = '550e8400-e29b-41d4-a716-446655440003';
const ITEM_2 = '550e8400-e29b-41d4-a716-446655440004';
const ITEM_3 = '550e8400-e29b-41d4-a716-446655440005';

describe('DeliveryPlansService', () => {
  let service: DeliveryPlansService;
  let repo: any;
  let authz: any;

  const plan = {
    id: 'plan-1',
    projectId: 'p1',
    name: 'Q1 Launch',
    description: null,
    createdBy: 'u1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    teamCount: 2,
    userTeamCount: 1,
  };

  const timelineRow = {
    teams: [
      { id: 't1', name: 'Web', areaIds: ['a1'], iterationIds: ['i1'] },
    ],
    iterations: [
      {
        id: 'i1',
        projectId: 'p1',
        name: 'Sprint 8',
        startDate: new Date('2026-02-01T00:00:00.000Z'),
        endDate: new Date('2026-02-15T00:00:00.000Z'),
        state: 'PLANNED',
      },
    ],
    workItems: [],
    dependencies: [],
    totalWorkItems: 0,
    hiddenTeamCount: 0,
    limit: 300,
    offset: 0,
  };

  beforeEach(async () => {
    repo = {
      listByProject: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      replaceTeams: vi.fn(),
      validateTeamsInProject: vi.fn(),
      getPlanTeams: vi.fn(),
      getUserTeamIds: vi.fn(),
      getTimeline: vi.fn(),
      getItemLinks: vi.fn(),
      createLink: vi.fn(),
      removeLink: vi.fn(),
      getDependencyEdges: vi.fn(),
    };

    authz = {
      requireProjectPermission: vi
        .fn()
        .mockImplementation(async (projectId, userId, permission) => ({
          projectId,
          userId,
          role: 'ADMIN',
          permission,
        })),
      requireWorkItemInProject: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryPlansService,
        { provide: DeliveryPlansRepository, useValue: repo },
        { provide: AuthorizationService, useValue: authz },
      ],
    }).compile();

    service = module.get<DeliveryPlansService>(DeliveryPlansService);
  });

  // ─── Authorization ─────────────────────────────────────────────────────────

  it('throws ForbiddenException when plan view is denied', async () => {
    authz.requireProjectPermission.mockRejectedValue(new ForbiddenException());
    await expect(service.findAll('u1', 'p1')).rejects.toThrow(ForbiddenException);
  });

  it('requires DELIVERY_PLAN_CREATE before creating a plan', async () => {
    authz.requireProjectPermission.mockRejectedValue(new ForbiddenException());
    await expect(service.create('u1', 'p1', { name: 'Plan' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(authz.requireProjectPermission).toHaveBeenCalledWith(
      'p1',
      'u1',
      expect.any(String),
    );
  });

  // ─── Create ────────────────────────────────────────────────────────────────

  it('rejects an invalid create payload', async () => {
    await expect(service.create('u1', 'p1', { name: '' })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('creates a plan and returns the last row from the project listing', async () => {
    repo.validateTeamsInProject.mockResolvedValue([TEAM_1]);
    repo.create.mockResolvedValue({ id: 'plan-1' });
    repo.listByProject.mockResolvedValue([plan, { ...plan, id: 'plan-2' }]);

    const result = await service.create('u1', 'p1', {
      name: 'Q1 Launch',
      description: 'Cool stuff',
      teamIds: [TEAM_1],
    });

    expect(repo.create).toHaveBeenCalledWith('p1', 'u1', {
      name: 'Q1 Launch',
      description: 'Cool stuff',
      teamIds: [TEAM_1],
    });
    expect(result.id).toBe('plan-2');
  });

  it('rejects team ids that do not belong to the project', async () => {
    repo.validateTeamsInProject.mockResolvedValue([TEAM_1]); // only t1 valid
    await expect(
      service.create('u1', 'p1', { name: 'Plan', teamIds: [TEAM_1, TEAM_2] }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  // ─── Update ────────────────────────────────────────────────────────────────

  it('updates name/description and replacement teams', async () => {
    repo.getById.mockResolvedValue(plan);
    repo.update.mockResolvedValue(plan);
    repo.validateTeamsInProject.mockResolvedValue([TEAM_1, TEAM_2]);
    repo.replaceTeams.mockResolvedValue(2);

    await service.update('u1', 'p1', plan.id, {
      name: 'Q2 Launch',
      teamIds: [TEAM_1, TEAM_2],
    });

    expect(repo.update).toHaveBeenCalledWith(plan.id, 'u1', {
      name: 'Q2 Launch',
      description: undefined,
    });
    expect(repo.replaceTeams).toHaveBeenCalledWith(plan.id, [TEAM_1, TEAM_2]);
  });

  it('throws NotFoundException when updating a missing plan', async () => {
    repo.getById.mockResolvedValue(null);
    await expect(
      service.update('u1', 'p1', plan.id, { name: 'Nope' }),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── Remove ────────────────────────────────────────────────────────────────

  it('deletes a plan after asserting it belongs to the project', async () => {
    repo.getById.mockResolvedValue(plan);
    repo.remove.mockResolvedValue(undefined);
    await expect(service.remove('u1', 'p1', plan.id)).resolves.toEqual({
      success: true,
    });
    expect(repo.remove).toHaveBeenCalledWith(plan.id);
  });

  it('throws NotFoundException when deleting a missing plan', async () => {
    repo.getById.mockResolvedValue(null);
    await expect(service.remove('u1', 'p1', plan.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ─── Plan teams ────────────────────────────────────────────────────────────

  it('annotates plan teams with the caller membership flag', async () => {
    repo.getById.mockResolvedValue(plan);
    repo.getPlanTeams.mockResolvedValue([
      { id: TEAM_1, name: 'Web', description: null, areaIds: [], iterationIds: [], memberCount: 3 },
      { id: TEAM_2, name: 'Mobile', description: null, areaIds: [], iterationIds: [], memberCount: 2 },
    ]);
    repo.getUserTeamIds.mockResolvedValue([TEAM_2]);

    const result = await service.getPlanTeams('u1', 'p1', plan.id);

    expect(result.find((t: any) => t.id === TEAM_1)?.isMember).toBe(false);
    expect(result.find((t: any) => t.id === TEAM_2)?.isMember).toBe(true);
  });

  it('replaces plan teams via setPlanTeams', async () => {
    repo.getById.mockResolvedValue(plan);
    repo.validateTeamsInProject.mockResolvedValue([TEAM_1]);
    repo.replaceTeams.mockResolvedValue(1);

    await expect(
      service.setPlanTeams('u1', 'p1', plan.id, { teamIds: [TEAM_1] }),
    ).resolves.toEqual({ planId: plan.id, teamCount: 1 });
  });

  // ─── Timeline ──────────────────────────────────────────────────────────────

  it('delegates the timeline lookup with parsed+clamped query params', async () => {
    repo.getById.mockResolvedValue(plan);
    repo.getTimeline.mockResolvedValue(timelineRow);

    const result = await service.getTimeline('u1', 'p1', plan.id, {
      teamId: TEAM_1,
      limit: '50',
      offset: '100',
    });

    expect(repo.getTimeline).toHaveBeenCalledWith({
      projectId: 'p1',
      planId: plan.id,
      userId: 'u1',
      teamId: TEAM_1,
      iterationId: undefined,
      limit: 50,
      offset: 100,
    });
    expect(result).toEqual({ plan, ...timelineRow });
  });

  it('rejects invalid timeline query params', async () => {
    repo.getById.mockResolvedValue(plan);
    await expect(
      service.getTimeline('u1', 'p1', plan.id, { limit: 'not-a-number' }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.getTimeline).not.toHaveBeenCalled();
  });

  // ─── Dependencies ──────────────────────────────────────────────────────────

  it('groups item links into outgoing and incoming', async () => {
    const links = [
      { id: 'l1', sourceWorkItemId: ITEM_1, targetWorkItemId: ITEM_2, linkType: 'DEPENDS_ON' },
      { id: 'l2', sourceWorkItemId: ITEM_3, targetWorkItemId: ITEM_1, linkType: 'RELATED' },
    ];
    repo.getItemLinks.mockResolvedValue(links);

    const result = await service.getItemLinks('u1', 'p1', ITEM_1);

    expect(result.outgoing).toHaveLength(1);
    expect(result.outgoing[0].id).toBe('l1');
    expect(result.incoming).toHaveLength(1);
    expect(result.incoming[0].id).toBe('l2');
  });

  it('rejects self-dependencies', async () => {
    await expect(
      service.createLink('u1', 'p1', ITEM_1, {
        targetWorkItemId: ITEM_1,
        linkType: 'DEPENDS_ON',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.createLink).not.toHaveBeenCalled();
  });

  it('rejects links to items outside the project', async () => {
    authz.requireWorkItemInProject.mockRejectedValue(new NotFoundException());
    await expect(
      service.createLink('u1', 'p1', ITEM_1, {
        targetWorkItemId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a dependency that would create a cycle', async () => {
    repo.getDependencyEdges.mockResolvedValue([
      { sourceWorkItemId: ITEM_2, targetWorkItemId: ITEM_1 }, // wi-2 → wi-1
      { sourceWorkItemId: ITEM_3, targetWorkItemId: ITEM_2 }, // wi-3 → wi-2
    ]);
    // Adding wi-1 → wi-3 closes the loop (wi-3 already reaches wi-1).
    await expect(
      service.createLink('u1', 'p1', ITEM_1, {
        targetWorkItemId: ITEM_3,
        linkType: 'DEPENDS_ON',
      }),
    ).rejects.toThrow('cycle');
    expect(repo.createLink).not.toHaveBeenCalled();
  });

  it('allows a non-cyclic dependency', async () => {
    repo.getDependencyEdges.mockResolvedValue([
      { sourceWorkItemId: ITEM_1, targetWorkItemId: ITEM_2 },
    ]);
    repo.createLink.mockResolvedValue({ id: 'l1' });

    await expect(
      service.createLink('u1', 'p1', ITEM_3, {
        targetWorkItemId: ITEM_2,
        linkType: 'DEPENDS_ON',
      }),
    ).resolves.toEqual({ id: 'l1' });
  });

  it('skips cycle checks for RELATED links', async () => {
    repo.createLink.mockResolvedValue({ id: 'l2' });
    await expect(
      service.createLink('u1', 'p1', ITEM_1, {
        targetWorkItemId: ITEM_2,
        linkType: 'RELATED',
      }),
    ).resolves.toEqual({ id: 'l2' });
    expect(repo.getDependencyEdges).not.toHaveBeenCalled();
  });

  it('rejects invalid dependency payload', async () => {
    await expect(
      service.createLink('u1', 'p1', ITEM_1, { linkType: 'BOGUS' }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.createLink).not.toHaveBeenCalled();
  });

  it('surfaces duplicate-dependency errors from the repository', async () => {
    repo.getDependencyEdges.mockResolvedValue([]);
    repo.createLink.mockRejectedValue(
      new BadRequestException('This dependency already exists'),
    );
    await expect(
      service.createLink('u1', 'p1', ITEM_1, {
        targetWorkItemId: ITEM_2,
        linkType: 'DEPENDS_ON',
      }),
    ).rejects.toThrow('already exists');
  });

  it('removes a dependency', async () => {
    repo.removeLink.mockResolvedValue(true);
    await expect(
      service.removeLink('u1', 'p1', ITEM_1, ITEM_2),
    ).resolves.toEqual({ success: true });
    expect(repo.removeLink).toHaveBeenCalledWith('p1', ITEM_1, ITEM_2);
  });

  it('throws NotFoundException when removing a missing dependency', async () => {
    repo.removeLink.mockResolvedValue(false);
    await expect(
      service.removeLink('u1', 'p1', ITEM_1, ITEM_2),
    ).rejects.toThrow(NotFoundException);
  });
});