import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TeamsService } from './teams.service.js';
import { TeamsRepository } from './teams.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';

describe('TeamsService', () => {
  let service: TeamsService;
  let repo: any;
  let projectsService: any;
  let authz: any;

  const team = {
    id: 'team-1',
    project_id: 'p1',
    name: 'Mobile Team',
    description: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    repo = {
      listByProject: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      addMember: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      getMembers: vi.fn(),
      getMember: vi.fn(),
      isProjectMember: vi.fn(),
      countAdmins: vi.fn(),
      updateMemberRole: vi.fn(),
      removeMember: vi.fn(),
      getSettings: vi.fn(),
      updateSettings: vi.fn(),
      getTeamScope: vi.fn(),
      countTeamAreaItems: vi.fn(),
      getIterationProject: vi.fn(),
      getAreaProject: vi.fn(),
    };

    projectsService = {
      assertProjectMember: vi.fn(),
      findOne: vi.fn(),
    };

    authz = {
      requireProjectPermission: vi.fn().mockImplementation(async (projectId, userId) => ({
        projectId,
        userId,
        role: 'ADMIN',
      })),
      requireProjectMember: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: TeamsRepository, useValue: repo },
        { provide: ProjectsService, useValue: projectsService },
        { provide: AuthorizationService, useValue: authz },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  // ─── Authorization ─────────────────────────────────────────────────────────

  it('should throw ForbiddenException when user is not a project member', async () => {
    authz.requireProjectPermission.mockRejectedValue(new ForbiddenException());
    await expect(service.findAll('u1', 'p1')).rejects.toThrow(ForbiddenException);
    await expect(service.create('u1', 'p1', { name: 'X' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should require team membership for team-scoped reads and writes', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue(null);
    await expect(service.findOne('u1', 'p1', team.id)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should require ADMIN role for mutations', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue({ user_id: 'u1', role: 'MEMBER' });
    await expect(service.update('u1', 'p1', team.id, { name: 'X' })).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.remove('u1', 'p1', team.id)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw NotFound when the team does not exist', async () => {
    repo.getById.mockResolvedValue(null);
    await expect(service.findOne('u1', 'p1', 'nope')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.getTeamScope('p1', 'nope')).rejects.toThrow(
      NotFoundException,
    );
  });

  // ─── Teams ─────────────────────────────────────────────────────────────────

  it('should list teams by project', async () => {
    repo.listByProject.mockResolvedValue([{ id: 'team-1', name: 'A' }]);
    const result = await service.findAll('u1', 'p1');
    expect(repo.listByProject).toHaveBeenCalledWith('p1', 'u1');
    expect(result).toEqual([{ id: 'team-1', name: 'A' }]);
  });

  it('should create a team and add the creator as ADMIN', async () => {
    repo.create.mockResolvedValue(team);
    const result = await service.create('u1', 'p1', { name: '  Mobile Team  ' });
    expect(repo.create).toHaveBeenCalledWith('p1', 'Mobile Team', null);
    expect(repo.addMember).toHaveBeenCalledWith('team-1', 'u1', 'ADMIN');
    expect(result.id).toBe('team-1');
  });

  it('should reject creating a team with an empty name', async () => {
    await expect(service.create('u1', 'p1', { name: '   ' })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('should update a team when the user is an admin', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue({ user_id: 'u1', role: 'ADMIN' });
    repo.update.mockResolvedValue({ ...team, name: 'Renamed' });
    const result = await service.update('u1', 'p1', team.id, {
      name: ' Renamed ',
      description: null,
    });
    expect(repo.update).toHaveBeenCalledWith(team.id, 'Renamed', null);
    expect(result.name).toBe('Renamed');
  });

  it('should reject an empty team name on update', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue({ user_id: 'u1', role: 'ADMIN' });
    await expect(service.update('u1', 'p1', team.id, { name: '  ' })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  // ─── Members ───────────────────────────────────────────────────────────────

  it('should reject adding a member who is not a project member', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue({ user_id: 'u1', role: 'ADMIN' });
    repo.isProjectMember.mockResolvedValue(false);
    await expect(
      service.addMember('u1', 'p1', team.id, { userId: 'u2', role: 'MEMBER' }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.addMember).not.toHaveBeenCalled();
  });

  it('should add a member with the specified role', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue({ user_id: 'u1', role: 'ADMIN' });
    repo.isProjectMember.mockResolvedValue(true);
    await service.addMember('u1', 'p1', team.id, { userId: 'u2', role: 'ADMIN' });
    expect(repo.addMember).toHaveBeenCalledWith(team.id, 'u2', 'ADMIN');
  });

  it('should default a new member to MEMBER when role omitted', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue({ user_id: 'u1', role: 'ADMIN' });
    repo.isProjectMember.mockResolvedValue(true);
    await service.addMember('u1', 'p1', team.id, { userId: 'u2', role: 'ADMIN' });
    expect(repo.addMember).toHaveBeenCalledWith(team.id, 'u2', 'ADMIN');
  });

  it('should throw NotFound when updating a missing member', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember
      .mockResolvedValueOnce({ user_id: 'u1', role: 'ADMIN' })
      .mockResolvedValueOnce(null);
    await expect(
      service.updateMemberRole('u1', 'p1', team.id, 'u2', 'ADMIN'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should block demoting the last team administrator', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue({ user_id: 'u1', role: 'ADMIN' });
    repo.getMember.mockResolvedValue({ user_id: 'u2', role: 'ADMIN' });
    repo.countAdmins.mockResolvedValue(1);
    await expect(
      service.updateMemberRole('u1', 'p1', team.id, 'u2', 'MEMBER'),
    ).rejects.toThrow(BadRequestException);
    expect(repo.updateMemberRole).not.toHaveBeenCalled();
  });

  it('should allow demoting an admin when another admin remains', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue({ user_id: 'u1', role: 'ADMIN' });
    repo.getMember.mockResolvedValue({ user_id: 'u2', role: 'ADMIN' });
    repo.countAdmins.mockResolvedValue(2);
    repo.updateMemberRole.mockResolvedValue({ role: 'MEMBER' });
    const result = await service.updateMemberRole('u1', 'p1', team.id, 'u2', 'MEMBER');
    expect(repo.updateMemberRole).toHaveBeenCalledWith(team.id, 'u2', 'MEMBER');
    expect(result.role).toBe('MEMBER');
  });

  it('should block removing the last team administrator', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue({ user_id: 'u1', role: 'ADMIN' });
    repo.getMember.mockResolvedValue({ user_id: 'u2', role: 'ADMIN' });
    repo.countAdmins.mockResolvedValue(1);
    await expect(service.removeMember('u1', 'p1', team.id, 'u2')).rejects.toThrow(
      BadRequestException,
    );
  });

  // ─── Settings / scope ──────────────────────────────────────────────────────

  it('should get settings for a team member', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue({ user_id: 'u1', role: 'MEMBER' });
    repo.getSettings.mockResolvedValue({ areas: ['a1'], iterations: [] });
    const result = await service.getSettings('u1', 'p1', team.id);
    expect(result.areas).toEqual(['a1']);
  });

  it('should validate iterations belong to the project when updating settings', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue({ user_id: 'u1', role: 'ADMIN' });
    repo.getIterationProject.mockResolvedValue('other-project');
    await expect(
      service.updateSettings('u1', 'p1', team.id, { iterationIds: ['it-x'] }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.updateSettings).not.toHaveBeenCalled();
  });

  it('should validate areas belong to the project when updating settings', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue({ user_id: 'u1', role: 'ADMIN' });
    repo.getAreaProject.mockResolvedValue('other-project');
    await expect(
      service.updateSettings('u1', 'p1', team.id, { areaIds: ['a-x'] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should update settings and return the refreshed settings', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue({ user_id: 'u1', role: 'ADMIN' });
    repo.getIterationProject.mockResolvedValue('p1');
    repo.getAreaProject.mockResolvedValue('p1');
    repo.getSettings.mockResolvedValue({ areas: ['a1'], iterations: ['it1'] });
    const result = await service.updateSettings('u1', 'p1', team.id, {
      iterationIds: ['it1'],
      areaIds: ['a1'],
    });
    expect(repo.updateSettings).toHaveBeenCalled();
    expect(result.iterations).toEqual(['it1']);
  });

  it('should return the resolved team scope', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getTeamScope.mockResolvedValue({ areaIds: ['a1'], iterationIds: ['it1'] });
    const scope = await service.getTeamScope('p1', team.id);
    expect(scope).toEqual({ areaIds: ['a1'], iterationIds: ['it1'] });
  });

  it('should forbid reordering items outside the team area scope', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue({ user_id: 'u1', role: 'MEMBER' });
    repo.countTeamAreaItems.mockResolvedValue(1);
    await expect(
      service.assertItemsInTeamScope('u1', 'p1', team.id, ['wi-1', 'wi-2']),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow reordering items inside the team area scope', async () => {
    repo.getById.mockResolvedValue(team);
    repo.getMember.mockResolvedValue({ user_id: 'u1', role: 'MEMBER' });
    repo.countTeamAreaItems.mockResolvedValue(2);
    await expect(
      service.assertItemsInTeamScope('u1', 'p1', team.id, ['wi-1', 'wi-2']),
    ).resolves.toBeUndefined();
  });
});