import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationsService } from './organizations.service.js';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { OrganizationsRepository } from './organizations.repository.js';
import type { AuthorizationService } from '../authorization/authorization.service.js';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let repo: Partial<OrganizationsRepository>;
  let authz: Partial<AuthorizationService>;

  beforeEach(() => {
    repo = {
      getOrganizationsForUser: vi.fn(),
      getOrganizationById: vi.fn(),
      createOrganization: vi.fn(),
      updateOrganization: vi.fn(),
      getMembers: vi.fn(),
      getMember: vi.fn(),
      addMember: vi.fn(),
      updateMemberRole: vi.fn(),
      removeMember: vi.fn(),
      countOwners: vi.fn(),
      getProjectsForOrganization: vi.fn(),
      findUserByEmailOrId: vi.fn(),
    };

    authz = {
      requireOrgMember: vi.fn(),
      requireOrgAdmin: vi.fn(),
      requireOrgOwner: vi.fn(),
      assertProjectBelongsToOrganization: vi.fn(),
    };

    service = new OrganizationsService(
      repo as OrganizationsRepository,
      authz as AuthorizationService,
    );
  });

  describe('findAll', () => {
    it('returns all organizations the user belongs to', async () => {
      const mockOrgs = [
        {
          id: 'org-1',
          name: 'Acme Corp',
          description: 'Acme workspace',
          role: 'OWNER' as const,
          memberCount: 5,
          projectCount: 2,
          createdAt: new Date().toISOString(),
          updatedAt: undefined,
        },
      ];
      vi.mocked(repo.getOrganizationsForUser!).mockResolvedValue(mockOrgs);

      const result = await service.findAll('user-1');
      expect(result).toEqual(mockOrgs);
      expect(repo.getOrganizationsForUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('create', () => {
    it('throws BadRequestException if organization name is empty', async () => {
      await expect(service.create('user-1', { name: '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates organization and returns owner DTO', async () => {
      const createdOrg = {
        id: 'org-new',
        name: 'New Org',
        description: 'Description',
        created_by: 'user-1',
        created_at: new Date(),
        updated_at: new Date(),
      };
      vi.mocked(repo.createOrganization!).mockResolvedValue(createdOrg as any);

      const result = await service.create('user-1', {
        name: 'New Org',
        description: 'Description',
      });

      expect(result.id).toBe('org-new');
      expect(result.name).toBe('New Org');
      expect(result.role).toBe('OWNER');
      expect(repo.createOrganization).toHaveBeenCalledWith({
        name: 'New Org',
        description: 'Description',
        created_by: 'user-1',
      });
    });
  });

  describe('findOne & authorization', () => {
    it('enforces requireOrgMember and returns organization details', async () => {
      vi.mocked(authz.requireOrgMember!).mockResolvedValue({
        organizationId: 'org-1',
        userId: 'user-1',
        role: 'ADMIN',
      });
      vi.mocked(repo.getOrganizationById!).mockResolvedValue({
        id: 'org-1',
        name: 'Acme',
        description: 'Org desc',
        memberCount: 3,
        projectCount: 1,
        createdAt: '2026-01-01',
      } as any);

      const result = await service.findOne('org-1', 'user-1');
      expect(authz.requireOrgMember).toHaveBeenCalledWith('org-1', 'user-1');
      expect(result.id).toBe('org-1');
      expect(result.role).toBe('ADMIN');
    });

    it('propagates ForbiddenException if user is not member of the organization', async () => {
      vi.mocked(authz.requireOrgMember!).mockRejectedValue(
        new ForbiddenException('You do not belong to this organization'),
      );

      await expect(service.findOne('org-foreign', 'user-attacker')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update organization settings', () => {
    it('requires admin or owner privileges to update settings', async () => {
      vi.mocked(authz.requireOrgAdmin!).mockResolvedValue({
        organizationId: 'org-1',
        userId: 'admin-user',
        role: 'ADMIN',
      });
      vi.mocked(repo.updateOrganization!).mockResolvedValue({ id: 'org-1' } as any);
      vi.mocked(repo.getOrganizationById!).mockResolvedValue({
        id: 'org-1',
        name: 'Renamed Org',
        description: 'New Description',
        memberCount: 3,
        projectCount: 1,
        createdAt: '2026-01-01',
      } as any);

      const updated = await service.update('org-1', 'admin-user', {
        name: 'Renamed Org',
        description: 'New Description',
      });

      expect(authz.requireOrgAdmin).toHaveBeenCalledWith('org-1', 'admin-user');
      expect(updated.name).toBe('Renamed Org');
    });

    it('rejects update if user is only a MEMBER', async () => {
      vi.mocked(authz.requireOrgAdmin!).mockRejectedValue(
        new ForbiddenException('You do not have administrative privileges in this organization'),
      );

      await expect(
        service.update('org-1', 'member-user', { name: 'Hack' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('member management & sole owner protection', () => {
    it('adds member when target user exists', async () => {
      vi.mocked(authz.requireOrgAdmin!).mockResolvedValue({
        organizationId: 'org-1',
        userId: 'admin-1',
        role: 'ADMIN',
      });
      vi.mocked(repo.findUserByEmailOrId!).mockResolvedValue({
        id: 'user-new',
        email: 'new@example.com',
        name: 'New User',
        avatar_url: null,
      });
      vi.mocked(repo.getMember!).mockResolvedValue({
        id: 'mem-1',
        organizationId: 'org-1',
        userId: 'user-new',
        role: 'MEMBER',
        name: 'New User',
        email: 'new@example.com',
        avatarUrl: null,
        createdAt: '2026-01-01',
      });

      const member = await service.addMember('org-1', 'admin-1', {
        email: 'new@example.com',
        role: 'MEMBER',
      });

      expect(member.userId).toBe('user-new');
      expect(repo.addMember).toHaveBeenCalledWith('org-1', 'user-new', 'MEMBER');
    });

    it('prevents non-owner from adding an OWNER', async () => {
      vi.mocked(authz.requireOrgAdmin!).mockResolvedValue({
        organizationId: 'org-1',
        userId: 'admin-1',
        role: 'ADMIN',
      });
      vi.mocked(repo.findUserByEmailOrId!).mockResolvedValue({
        id: 'user-new',
        email: 'new@example.com',
        name: 'New User',
        avatar_url: null,
      });

      await expect(
        service.addMember('org-1', 'admin-1', {
          email: 'new@example.com',
          role: 'OWNER',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('prevents demoting the sole owner of the organization', async () => {
      vi.mocked(authz.requireOrgAdmin!).mockResolvedValue({
        organizationId: 'org-1',
        userId: 'owner-1',
        role: 'OWNER',
      });
      vi.mocked(repo.getMember!).mockResolvedValue({
        id: 'mem-1',
        organizationId: 'org-1',
        userId: 'owner-1',
        role: 'OWNER',
        name: 'Sole Owner',
        email: 'owner@example.com',
        avatarUrl: null,
        createdAt: '2026-01-01',
      });
      vi.mocked(repo.countOwners!).mockResolvedValue(1);

      await expect(
        service.updateMemberRole('org-1', 'owner-1', 'owner-1', 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
    });

    it('prevents removing the sole owner of the organization', async () => {
      vi.mocked(authz.requireOrgMember!).mockResolvedValue({
        organizationId: 'org-1',
        userId: 'owner-1',
        role: 'OWNER',
      });
      vi.mocked(repo.countOwners!).mockResolvedValue(1);

      await expect(
        service.removeMember('org-1', 'owner-1', 'owner-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows removing an owner if multiple owners exist', async () => {
      vi.mocked(authz.requireOrgAdmin!).mockResolvedValue({
        organizationId: 'org-1',
        userId: 'owner-1',
        role: 'OWNER',
      });
      vi.mocked(repo.getMember!).mockResolvedValue({
        id: 'mem-2',
        organizationId: 'org-1',
        userId: 'owner-2',
        role: 'OWNER',
        name: 'Second Owner',
        email: 'owner2@example.com',
        avatarUrl: null,
        createdAt: '2026-01-01',
      });
      vi.mocked(repo.countOwners!).mockResolvedValue(2);
      vi.mocked(repo.removeMember!).mockResolvedValue(undefined as any);

      const result = await service.removeMember('org-1', 'owner-1', 'owner-2');
      expect(result).toEqual({ success: true });
      expect(repo.removeMember).toHaveBeenCalledWith('org-1', 'owner-2');
    });
  });
});
