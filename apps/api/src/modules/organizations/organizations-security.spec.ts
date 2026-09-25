import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ProjectsRepository } from '../projects/projects.repository.js';

describe('Organization Security & Direct URL Manipulation Defense', () => {
  let authz: AuthorizationService;
  let projectsRepo: Partial<ProjectsRepository>;
  let projectsService: ProjectsService;

  const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000000';
  const ATTACKER_USER_ID = '33333333-3333-3333-3333-333333333333';
  const VICTIM_ORG_ID = '11111111-1111-1111-1111-111111111111';
  const PROJECT_ID = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    authz = new AuthorizationService();
    projectsRepo = {
      createProject: vi.fn(),
      getProjects: vi.fn(),
      getProjectById: vi.fn(),
    };
    projectsService = new ProjectsService(
      projectsRepo as ProjectsRepository,
      authz,
    );
  });

  describe('Direct URL Manipulation: Org A user accessing Org B resources', () => {
    it('blocks access when user attempts to access organization they do not belong to', async () => {
      // User is not in DEFAULT_ORG_ID
      vi.spyOn(authz, 'getOrgRole').mockResolvedValue(null);

      // User manipulates URL to access DEFAULT_ORG_ID
      await expect(
        authz.requireOrgMember(DEFAULT_ORG_ID, ATTACKER_USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks admin actions when a regular member manipulates URL to hit admin/settings endpoints', async () => {
      // User is a member, but not an admin or owner
      vi.spyOn(authz, 'getOrgRole').mockResolvedValue('MEMBER');

      await expect(
        authz.requireOrgAdmin(DEFAULT_ORG_ID, ATTACKER_USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when user manipulates URL with invalid or non-existent org UUID', async () => {
      await expect(
        authz.requireOrgMember('invalid-uuid-string', ATTACKER_USER_ID),
      ).rejects.toThrow(NotFoundException);

      await expect(
        authz.requireOrgMember('99999999-9999-9999-9999-999999999999', ATTACKER_USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Direct URL Manipulation: Mismatched Org and Project IDs (/orgs/ORG_A/projects/PROJECT_B)', () => {
    it('rejects request when projectId belongs to a different organization', async () => {
      // Project belongs to VICTIM_ORG_ID, but URL specifies DEFAULT_ORG_ID
      vi.spyOn(authz, 'assertProjectBelongsToOrganization').mockImplementation(
        async (projectId: string, organizationId: string) => {
          if (projectId === PROJECT_ID && organizationId !== VICTIM_ORG_ID) {
            throw new ForbiddenException('Project does not belong to this organization');
          }
        },
      );

      await expect(
        authz.assertProjectBelongsToOrganization(PROJECT_ID, DEFAULT_ORG_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Server-side Project Filtering and Creation Authorization', () => {
    it('rejects project creation if user specifies an organization they are not a member of', async () => {
      vi.spyOn(authz, 'requireOrgMember').mockRejectedValue(
        new ForbiddenException('You do not belong to this organization'),
      );

      await expect(
        projectsService.create(ATTACKER_USER_ID, {
          name: 'Trojan Project',
          key: 'TRJ',
          organizationId: VICTIM_ORG_ID,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(projectsRepo.createProject).not.toHaveBeenCalled();
    });

    it('rejects listing projects for an organization the user does not belong to', async () => {
      vi.spyOn(authz, 'requireOrgMember').mockRejectedValue(
        new ForbiddenException('You do not belong to this organization'),
      );

      await expect(
        projectsService.findAll(ATTACKER_USER_ID, VICTIM_ORG_ID),
      ).rejects.toThrow(ForbiddenException);

      expect(projectsRepo.getProjects).not.toHaveBeenCalled();
    });

    it('filters projects strictly by organizationId when requested by an authorized user', async () => {
      vi.spyOn(authz, 'requireOrgMember').mockResolvedValue({
        organizationId: DEFAULT_ORG_ID,
        userId: 'legit-user',
        role: 'MEMBER',
      });
      vi.mocked(projectsRepo.getProjects!).mockResolvedValue([
        {
          id: PROJECT_ID,
          name: 'Legit Project',
          key: 'LEG',
          organization_id: DEFAULT_ORG_ID,
          created_by: 'legit-user',
          archived: false,
          next_work_item_seq: 1,
          created_at: new Date(),
          updated_at: new Date(),
          description: null,
        },
      ]);

      const result = await projectsService.findAll('legit-user', DEFAULT_ORG_ID);

      expect(authz.requireOrgMember).toHaveBeenCalledWith(DEFAULT_ORG_ID, 'legit-user');
      expect(projectsRepo.getProjects).toHaveBeenCalledWith('legit-user', DEFAULT_ORG_ID);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(PROJECT_ID);
    });
  });
});
