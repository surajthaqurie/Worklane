import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProjectsRepository } from './projects.repository.js';
import { CreateProjectDto, UpdateProjectDto } from './dto/projects.dto.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';

import { AuditLoggerService } from '../audit/audit-logger.service.js';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repo: ProjectsRepository,
    private readonly authz: AuthorizationService,
    private readonly auditLogger?: AuditLoggerService,
  ) {}

  /**
   * Legacy compatibility helper used by other services (WorkItemsService, etc.)
   * to gate project access. Returns the project row.
   *
   * @deprecated Prefer calling `authz.requireProjectPermissionWithProject`
   *   directly in the consuming service to specify the exact permission needed
   *   without a second project lookup.
   */
  async assertProjectMember(projectId: string, userId: string) {
    const { project, membership } = await this.authz.requireProjectPermissionWithProject(
      projectId,
      userId,
      Permission.PROJECT_VIEW,
    );
    // Attach role so callers can inspect it
    return { ...project, _role: membership.role };
  }

  async create(userId: string, data: CreateProjectDto) {
    const orgId = data.organizationId ?? '00000000-0000-0000-0000-000000000000';
    await this.authz.requireOrgMember(orgId, userId);

    const project = await this.repo.createProject({
      name: data.name,
      key: data.key,
      description: data.description,
      organization_id: orgId,
      created_by: userId,
    });
    // Creator is added as OWNER in project_members (repo handles this)
    if (this.auditLogger) {
      void this.auditLogger.logEvent('PROJECT_CREATED', userId, project.id, {
        name: project.name,
        key: project.key,
      });
    }
    return this.mapProject(project);
  }

  async findAll(userId: string, organizationId?: string) {
    if (organizationId) {
      await this.authz.requireOrgMember(organizationId, userId);
    }
    const projects = await this.repo.getProjects(userId, organizationId);
    return projects.map(this.mapProject);
  }

  async findOne(userId: string, projectId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    const project = await this.repo.getProjectById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    return this.mapProject(project);
  }

  async update(userId: string, projectId: string, data: UpdateProjectDto) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_EDIT);
    const updated = await this.repo.updateProject(projectId, data);
    return this.mapProject(updated);
  }

  async remove(userId: string, projectId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_DELETE);
    await this.repo.deleteProject(projectId);
    if (this.auditLogger) {
      void this.auditLogger.logEvent('PROJECT_DELETED', userId, projectId);
    }
    return { success: true };
  }

  async addMember(userId: string, projectId: string, targetUserId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER') {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_MANAGE_MEMBERS);
    await this.repo.addMember(projectId, targetUserId, role);
    if (this.auditLogger) {
      void this.auditLogger.logEvent('MEMBER_ADDED', userId, projectId, {
        targetUserId,
        role,
      });
    }
    return { success: true };
  }

  async getMembers(userId: string, projectId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    return this.repo.getMembers(projectId);
  }

  async getOverview(userId: string, projectId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    return this.repo.getProjectOverview(projectId);
  }

  async removeMember(userId: string, projectId: string, targetUserId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_MANAGE_MEMBERS);

    // Prevent removing the last OWNER
    const members = await this.repo.getMembers(projectId);
    const owners = members.filter((m) => m.role === 'OWNER');
    const targetMember = members.find((m) => m.userId === targetUserId);
    if (targetMember?.role === 'OWNER' && owners.length <= 1) {
      throw new ForbiddenException('Cannot remove the last project owner');
    }

    await this.repo.removeMember(projectId, targetUserId);
    if (this.auditLogger) {
      void this.auditLogger.logEvent('MEMBER_REMOVED', userId, projectId, {
        targetUserId,
      });
    }
    return { success: true };
  }

  async updateMemberRole(
    userId: string,
    projectId: string,
    targetUserId: string,
    newRole: 'OWNER' | 'ADMIN' | 'MEMBER',
  ) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_MANAGE_MEMBERS);

    // Prevent demoting the last OWNER
    const members = await this.repo.getMembers(projectId);
    const owners = members.filter((m) => m.role === 'OWNER');
    const targetMember = members.find((m) => m.userId === targetUserId);
    if (targetMember?.role === 'OWNER' && newRole !== 'OWNER' && owners.length <= 1) {
      throw new ForbiddenException('Cannot demote the last project owner');
    }

    await this.repo.updateMemberRole(projectId, targetUserId, newRole);
    if (this.auditLogger) {
      void this.auditLogger.logEvent('ROLE_CHANGED', userId, projectId, {
        targetUserId,
        newRole,
        previousRole: targetMember?.role,
      });
    }
    return { success: true };
  }

  async getAreas(userId: string, projectId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    return this.repo.getAreas(projectId);
  }

  async getTags(userId: string, projectId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
    return this.repo.getTags(projectId);
  }

  /**
   * Returns the caller's permissions for a project.
   * Used by the frontend to gate UI actions without an extra round-trip.
   */
  async getMyPermissions(userId: string, projectId: string) {
    return this.authz.getProjectPermissions(projectId, userId);
  }

  private mapProject(p: any) {
    return {
      id: p.id,
      organizationId: p.organization_id,
      name: p.name,
      description: p.description,
      key: p.key,
      createdBy: p.created_by,
      archived: p.archived,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  }
}
