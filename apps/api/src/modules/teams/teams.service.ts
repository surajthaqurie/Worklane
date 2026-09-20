import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { TeamsRepository, TeamRole } from './teams.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';
import { AuditLoggerService } from '../audit/audit-logger.service.js';

export interface TeamScope {
  areaIds: string[];
  iterationIds: string[];
}

@Injectable()
export class TeamsService {
  constructor(
    private readonly repo: TeamsRepository,
    private readonly projectsService: ProjectsService,
    private readonly authz: AuthorizationService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  /** Project membership grants access to the project; team data also requires it. */
  async assertProjectMember(projectId: string, userId: string) {
    return this.projectsService.assertProjectMember(projectId, userId);
  }

  /**
   * Requires both project membership AND membership of the specific team.
   * Returns the membership row.
   */
  async assertTeamMember(projectId: string, teamId: string, userId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.TEAM_VIEW);
    const team = await this.repo.getById(projectId, teamId);
    if (!team) throw new NotFoundException('Team not found');
    const member = await this.repo.getMember(teamId, userId);
    if (!member) {
      throw new ForbiddenException('You do not belong to this team');
    }
    return member;
  }

  /** Requires team membership with the ADMIN role. */
  async assertTeamAdmin(projectId: string, teamId: string, userId: string) {
    const member = await this.assertTeamMember(projectId, teamId, userId);
    if (member.role !== 'ADMIN') {
      throw new ForbiddenException('You must be a team administrator to do this');
    }
    return member;
  }

  // ─── Teams ─────────────────────────────────────────────────────────────────

  async findAll(userId: string, projectId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.TEAM_VIEW);
    return this.repo.listByProject(projectId, userId);
  }

  async findOne(userId: string, projectId: string, teamId: string) {
    await this.assertTeamMember(projectId, teamId, userId);
    return this.repo.getById(projectId, teamId);
  }

  async create(userId: string, projectId: string, data: { name: string; description?: string }) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.TEAM_CREATE);
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('Team name is required');
    const team = await this.repo.create(projectId, name, data.description?.trim() || null);
    await this.repo.addMember(team.id, userId, 'ADMIN');
    return { id: team.id, projectId: team.project_id, name: team.name, description: team.description };
  }

  async update(
    userId: string,
    projectId: string,
    teamId: string,
    data: { name?: string; description?: string | null },
  ) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.TEAM_EDIT);
    // Also require team admin for narrower scope
    await this.assertTeamAdmin(projectId, teamId, userId);
    const name = data.name?.trim();
    if (name !== undefined && !name) throw new BadRequestException('Team name cannot be empty');
    return this.repo.update(teamId, name, data.description);
  }

  async remove(userId: string, projectId: string, teamId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.TEAM_DELETE);
    await this.assertTeamAdmin(projectId, teamId, userId);
    await this.repo.remove(teamId);
    return { success: true };
  }

  // ─── Members ───────────────────────────────────────────────────────────────

  async getMembers(userId: string, projectId: string, teamId: string) {
    await this.assertTeamMember(projectId, teamId, userId);
    return this.repo.getMembers(teamId);
  }

  async addMember(
    userId: string,
    projectId: string,
    teamId: string,
    data: { userId: string; role: TeamRole },
  ) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.TEAM_MANAGE);
    await this.assertTeamAdmin(projectId, teamId, userId);
    const targetIsProjectMember = await this.repo.isProjectMember(projectId, data.userId);
    if (!targetIsProjectMember) {
      throw new BadRequestException(
        'A user must be a project member before they can join a team',
      );
    }
    const role = data.role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
    await this.repo.addMember(teamId, data.userId, role);
    if (this.auditLogger) {
      void this.auditLogger.logEvent('MEMBER_ADDED', userId, projectId, {
        teamId,
        targetUserId: data.userId,
        role,
      });
    }
    return { success: true };
  }

  async updateMemberRole(
    userId: string,
    projectId: string,
    teamId: string,
    targetUserId: string,
    role: TeamRole,
  ) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.TEAM_MANAGE);
    await this.assertTeamAdmin(projectId, teamId, userId);
    const member = await this.repo.getMember(teamId, targetUserId);
    if (!member) throw new NotFoundException('Team member not found');
    const adminCount = await this.repo.countAdmins(teamId);
    if (member.role === 'ADMIN' && role !== 'ADMIN' && adminCount <= 1) {
      throw new BadRequestException('Cannot demote the last team administrator');
    }
    const nextRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
    const updated = await this.repo.updateMemberRole(teamId, targetUserId, nextRole);
    if (this.auditLogger) {
      void this.auditLogger.logEvent('ROLE_CHANGED', userId, projectId, {
        teamId,
        targetUserId,
        newRole: nextRole,
        previousRole: member.role,
      });
    }
    return { success: true, role: updated?.role ?? nextRole };
  }

  async removeMember(
    userId: string,
    projectId: string,
    teamId: string,
    targetUserId: string,
  ) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.TEAM_MANAGE);
    await this.assertTeamAdmin(projectId, teamId, userId);
    const member = await this.repo.getMember(teamId, targetUserId);
    if (!member) throw new NotFoundException('Team member not found');
    const adminCount = await this.repo.countAdmins(teamId);
    if (member.role === 'ADMIN' && adminCount <= 1) {
      throw new BadRequestException('Cannot remove the last team administrator');
    }
    await this.repo.removeMember(teamId, targetUserId);
    if (this.auditLogger) {
      void this.auditLogger.logEvent('MEMBER_REMOVED', userId, projectId, {
        teamId,
        targetUserId,
      });
    }
    return { success: true };
  }

  // ─── Settings / scope ──────────────────────────────────────────────────────

  async getSettings(userId: string, projectId: string, teamId: string) {
    await this.assertTeamMember(projectId, teamId, userId);
    return this.repo.getSettings(teamId);
  }

  async updateSettings(
    userId: string,
    projectId: string,
    teamId: string,
    settings: {
      boardConfig?: Record<string, unknown>;
      backlogConfig?: Record<string, unknown>;
      defaultIterationId?: string | null;
      defaultAreaId?: string | null;
      iterationIds?: string[];
      areaIds?: string[];
    },
  ) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.TEAM_MANAGE_SETTINGS);
    await this.assertTeamAdmin(projectId, teamId, userId);
    if (settings.iterationIds !== undefined) {
      await this.validateIterations(projectId, settings.iterationIds);
    }
    if (settings.areaIds !== undefined) {
      await this.validateAreas(projectId, settings.areaIds);
    }
    if (settings.defaultIterationId) {
      await this.validateIterations(projectId, [settings.defaultIterationId]);
    }
    if (settings.defaultAreaId) {
      await this.validateAreas(projectId, [settings.defaultAreaId]);
    }
    await this.repo.updateSettings(teamId, settings);
    return this.repo.getSettings(teamId);
  }

  /**
   * Resolves the effective team scope for filtering project-scoped work items.
   * A team sees work items in its areas, optionally in its iterations.
   */
  async getTeamScope(projectId: string, teamId: string): Promise<TeamScope> {
    const team = await this.repo.getById(projectId, teamId);
    if (!team) throw new NotFoundException('Team not found');
    return this.repo.getTeamScope(teamId);
  }

  /** Verifies every work item belongs to the team's area scope. */
  async assertItemsInTeamScope(
    userId: string,
    projectId: string,
    teamId: string,
    itemIds: string[],
  ) {
    await this.assertTeamMember(projectId, teamId, userId);
    if (itemIds.length === 0) return;
    const inScope = await this.repo.countTeamAreaItems(projectId, teamId, itemIds);
    if (inScope !== itemIds.length) {
      throw new ForbiddenException(
        'One or more work items do not belong to this team\'s scope',
      );
    }
  }

  private async validateIterations(projectId: string, iterationIds: string[]) {
    const rows = await Promise.all(
      iterationIds.map((id) =>
        this.repo.getIterationProject(id).then((pid) => ({ id, pid })),
      ),
    );
    const invalid = rows.filter((r) => r.pid !== projectId);
    if (invalid.length > 0) {
      throw new BadRequestException('Iterations must belong to the same project');
    }
  }

  private async validateAreas(projectId: string, areaIds: string[]) {
    const rows = await Promise.all(
      areaIds.map((id) => this.repo.getAreaProject(id).then((pid) => ({ id, pid }))),
    );
    const invalid = rows.filter((r) => r.pid !== projectId);
    if (invalid.length > 0) {
      throw new BadRequestException('Areas must belong to the same project');
    }
  }
}