import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { OrganizationsRepository } from './organizations.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { AuditLoggerService } from '../audit/audit-logger.service.js';
import type {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  AddOrganizationMemberDto,
  OrganizationRole,
  OrganizationDto,
  OrganizationMemberDto,
} from './dto/organizations.dto.js';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly repo: OrganizationsRepository,
    private readonly authz: AuthorizationService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  async findAll(userId: string): Promise<OrganizationDto[]> {
    return await this.repo.getOrganizationsForUser(userId);
  }

  async findOne(organizationId: string, userId: string): Promise<OrganizationDto> {
    const membership = await this.authz.requireOrgMember(organizationId, userId);
    const org = await this.repo.getOrganizationById(organizationId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return {
      ...org,
      role: membership.role,
    };
  }

  async create(userId: string, dto: CreateOrganizationDto): Promise<OrganizationDto> {
    const trimmedName = dto.name?.trim();
    if (!trimmedName) {
      throw new BadRequestException('Organization name is required');
    }

    const org = await this.repo.createOrganization({
      name: trimmedName,
      description: dto.description?.trim(),
      created_by: userId,
    });

    if (this.auditLogger) {
      void this.auditLogger.logEvent('ORGANIZATION_CREATED', userId, undefined, {
        organizationId: org.id,
        name: org.name,
      });
    }

    return {
      id: org.id,
      name: org.name,
      description: org.description,
      role: 'OWNER',
      memberCount: 1,
      projectCount: 0,
      createdAt: org.created_at ? new Date(org.created_at).toISOString() : new Date().toISOString(),
      updatedAt: org.updated_at ? new Date(org.updated_at).toISOString() : undefined,
    };
  }

  async update(
    organizationId: string,
    userId: string,
    dto: UpdateOrganizationDto,
  ): Promise<OrganizationDto> {
    const membership = await this.authz.requireOrgAdmin(organizationId, userId);

    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('Organization name cannot be empty');
    }

    const updated = await this.repo.updateOrganization(organizationId, {
      name: dto.name?.trim(),
      description: dto.description !== undefined ? dto.description.trim() : undefined,
    });

    if (!updated) {
      throw new NotFoundException('Organization not found');
    }

    if (this.auditLogger) {
      void this.auditLogger.logEvent('ORGANIZATION_UPDATED', userId, undefined, {
        organizationId,
        updatedFields: Object.keys(dto),
      });
    }

    const fresh = await this.repo.getOrganizationById(organizationId);
    if (!fresh) {
      throw new NotFoundException('Organization not found');
    }

    return {
      ...fresh,
      role: membership.role,
    };
  }

  async getMembers(organizationId: string, userId: string): Promise<OrganizationMemberDto[]> {
    await this.authz.requireOrgMember(organizationId, userId);
    return await this.repo.getMembers(organizationId);
  }

  async addMember(
    organizationId: string,
    userId: string,
    dto: AddOrganizationMemberDto,
  ): Promise<OrganizationMemberDto> {
    const actorMembership = await this.authz.requireOrgAdmin(organizationId, userId);

    const query = dto.userId || dto.email;
    if (!query) {
      throw new BadRequestException('Either userId or email must be provided');
    }

    const targetUser = await this.repo.findUserByEmailOrId(query);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const desiredRole: OrganizationRole = dto.role ?? 'MEMBER';
    if (desiredRole === 'OWNER' && actorMembership.role !== 'OWNER') {
      throw new ForbiddenException('Only organization owners can grant the OWNER role');
    }

    await this.repo.addMember(organizationId, targetUser.id, desiredRole);

    if (this.auditLogger) {
      void this.auditLogger.logEvent('ORGANIZATION_MEMBER_ADDED', userId, undefined, {
        organizationId,
        targetUserId: targetUser.id,
        role: desiredRole,
      });
    }

    const member = await this.repo.getMember(organizationId, targetUser.id);
    if (!member) {
      throw new NotFoundException('Failed to retrieve newly added member');
    }

    return member;
  }

  async updateMemberRole(
    organizationId: string,
    userId: string,
    targetUserId: string,
    role: OrganizationRole,
  ): Promise<OrganizationMemberDto> {
    const actorMembership = await this.authz.requireOrgAdmin(organizationId, userId);

    const currentMember = await this.repo.getMember(organizationId, targetUserId);
    if (!currentMember) {
      throw new NotFoundException('Organization member not found');
    }

    if (currentMember.role === 'OWNER' && actorMembership.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can modify an owner role');
    }

    if (role === 'OWNER' && actorMembership.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can promote members to owner');
    }

    if (currentMember.role === 'OWNER' && role !== 'OWNER') {
      const ownerCount = await this.repo.countOwners(organizationId);
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot demote the sole owner of the organization');
      }
    }

    await this.repo.updateMemberRole(organizationId, targetUserId, role);

    if (this.auditLogger) {
      void this.auditLogger.logEvent('ORGANIZATION_MEMBER_ROLE_UPDATED', userId, undefined, {
        organizationId,
        targetUserId,
        previousRole: currentMember.role,
        newRole: role,
      });
    }

    const updated = await this.repo.getMember(organizationId, targetUserId);
    if (!updated) {
      throw new NotFoundException('Failed to retrieve updated member');
    }

    return updated;
  }

  async removeMember(
    organizationId: string,
    userId: string,
    targetUserId: string,
  ): Promise<{ success: boolean }> {
    const isSelf = userId === targetUserId;

    if (!isSelf) {
      const actorMembership = await this.authz.requireOrgAdmin(organizationId, userId);
      const targetMember = await this.repo.getMember(organizationId, targetUserId);
      if (!targetMember) {
        throw new NotFoundException('Organization member not found');
      }

      if (targetMember.role === 'OWNER' && actorMembership.role !== 'OWNER') {
        throw new ForbiddenException('Only owners can remove an owner');
      }

      if (targetMember.role === 'OWNER') {
        const ownerCount = await this.repo.countOwners(organizationId);
        if (ownerCount <= 1) {
          throw new BadRequestException('Cannot remove the sole owner of the organization');
        }
      }
    } else {
      // User is removing themselves (leaving the org)
      const targetMember = await this.authz.requireOrgMember(organizationId, userId);
      if (targetMember.role === 'OWNER') {
        const ownerCount = await this.repo.countOwners(organizationId);
        if (ownerCount <= 1) {
          throw new BadRequestException(
            'Cannot leave the organization as the sole owner. Transfer ownership before leaving.',
          );
        }
      }
    }

    await this.repo.removeMember(organizationId, targetUserId);

    if (this.auditLogger) {
      void this.auditLogger.logEvent('ORGANIZATION_MEMBER_REMOVED', userId, undefined, {
        organizationId,
        targetUserId,
      });
    }

    return { success: true };
  }

  async getProjects(organizationId: string, userId: string) {
    await this.authz.requireOrgMember(organizationId, userId);
    return await this.repo.getProjectsForOrganization(organizationId, userId);
  }

  async getMyRole(organizationId: string, userId: string) {
    const membership = await this.authz.requireOrgMember(organizationId, userId);
    return {
      organizationId,
      userId,
      role: membership.role,
    };
  }
}
