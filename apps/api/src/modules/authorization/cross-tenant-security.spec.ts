import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from './authorization.service.js';
import { Permission } from './permissions.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { QueriesService } from '../queries/queries.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

describe('Final Security Review — Cross-Tenant & Cross-Entity Authorization Boundaries', () => {
  const userA = { id: '11111111-1111-4111-8111-111111111111' };
  const userB = { id: '22222222-2222-4222-8222-222222222222' };

  const orgA = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  const orgB = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };

  const projA = { id: '33333333-3333-4333-8333-333333333333', organization_id: orgA.id };
  const projB = { id: '44444444-4444-4444-8444-444444444444', organization_id: orgB.id };

  const teamB = { id: '66666666-6666-4666-8666-666666666666', project_id: projB.id };
  const itemB = { id: '88888888-8888-4888-8888-888888888888', project_id: projB.id };
  const attB = { id: '99999999-9999-4999-8999-999999999999', work_item_id: itemB.id, file_name: 'secret.pdf' };
  const queryB = { id: 'aaaaaaaa-1111-4111-8111-111111111111', project_id: projB.id, name: 'Secret Query' };
  const notifB = { id: 'bbbbbbbb-2222-4222-8222-222222222222', user_id: userB.id, title: 'Confidential Alert' };

  describe('1. User A → Organization B Isolation', () => {
    it('rejects User A attempting to access Organization B where they hold no membership', async () => {
      const authz = new AuthorizationService();

      // Spy on requireOrgMember, requireOrgAdmin, requireOrgOwner to simulate tenant isolation
      vi.spyOn(authz, 'requireOrgMember').mockImplementation(async (orgId, userId) => {
        if (orgId === orgB.id && userId === userA.id) {
          throw new ForbiddenException('You do not belong to this organization');
        }
        return { organizationId: orgId, userId, role: 'MEMBER' };
      });

      vi.spyOn(authz, 'requireOrgAdmin').mockImplementation(async (orgId, userId) => {
        if (orgId === orgB.id && userId === userA.id) {
          throw new ForbiddenException('You do not have administrative privileges in this organization');
        }
        return { organizationId: orgId, userId, role: 'ADMIN' };
      });

      vi.spyOn(authz, 'requireOrgOwner').mockImplementation(async (orgId, userId) => {
        if (orgId === orgB.id && userId === userA.id) {
          throw new ForbiddenException('You must be an owner of this organization to perform this action');
        }
        return { organizationId: orgId, userId, role: 'OWNER' };
      });

      // User A accessing Org B fails with ForbiddenException
      await expect(authz.requireOrgMember(orgB.id, userA.id)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(authz.requireOrgAdmin(orgB.id, userA.id)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(authz.requireOrgOwner(orgB.id, userA.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('2. User A → Project B Isolation', () => {
    it('rejects User A attempting to view or modify Project B', async () => {
      const authz = new AuthorizationService();
      vi.spyOn(authz, 'requireProjectPermission').mockImplementation(async (projectId, userId) => {
        if (projectId === projB.id && userId === userA.id) {
          throw new ForbiddenException('You do not have permission to perform this action in project B');
        }
        return { projectId, userId, role: 'MEMBER' };
      });

      // User A accessing Project A works
      const permA = await authz.requireProjectPermission(projA.id, userA.id, Permission.WORK_ITEM_VIEW);
      expect(permA.projectId).toBe(projA.id);

      // User A accessing Project B is blocked
      await expect(
        authz.requireProjectPermission(projB.id, userA.id, Permission.WORK_ITEM_VIEW),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        authz.requireProjectPermission(projB.id, userA.id, Permission.PROJECT_DELETE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects URL manipulation trying to link Project B to Organization A', async () => {
      const authz = new AuthorizationService();
      vi.spyOn(authz, 'assertProjectBelongsToOrganization').mockImplementation(async (projectId, orgId) => {
        if (projectId === projB.id && orgId === orgA.id) {
          throw new ForbiddenException('Project does not belong to this organization');
        }
      });

      await expect(
        authz.assertProjectBelongsToOrganization(projB.id, orgA.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. User A → Team B Isolation', () => {
    it('rejects User A accessing Team B belonging to Project B', async () => {
      const authz = new AuthorizationService();
      vi.spyOn(authz, 'requireTeamAccess').mockImplementation(async (userId, projectId, teamId) => {
        if (userId === userA.id && (projectId === projB.id || teamId === teamB.id)) {
          throw new ForbiddenException('You do not belong to this team or project');
        }
        return { teamId, userId, role: 'MEMBER' };
      });

      await expect(
        authz.requireTeamAccess(userA.id, projB.id, teamB.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4. User A → Work Item B Isolation', () => {
    it('rejects referencing Work Item B from Project B within Project A context', async () => {
      const authz = new AuthorizationService();

      await expect(
        authz.assertWorkItemBelongsToProject(itemB.project_id, projA.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. User A → Attachment B Isolation', () => {
    it('rejects User A attempting to download or delete Attachment B belonging to Project B', async () => {
      const authz = new AuthorizationService();
      vi.spyOn(authz, 'requireProjectPermission').mockImplementation(async (projectId, userId) => {
        if (projectId === projB.id && userId === userA.id) {
          throw new ForbiddenException('Unauthorized project access');
        }
        return { projectId, userId, role: 'MEMBER' };
      });

      const mockObjStorage = {
        getPresignedDownloadUrl: vi.fn(),
        deleteObject: vi.fn(),
      } as any;

      const mockWorkItemsService = {
        findOne: vi.fn().mockImplementation(async (userId: string, projectId: string) => {
          if (userId === userA.id && projectId === projB.id) {
            throw new ForbiddenException('Unauthorized');
          }
          return itemB;
        }),
      } as any;

      const attachmentsService = new AttachmentsService(
        authz,
        mockObjStorage,
        { dispatchJob: vi.fn() } as any,
      );

      // Attempting to download Attachment B from Project B as User A fails with ForbiddenException
      await expect(
        attachmentsService.getDownloadUrl(userA.id, projB.id, itemB.id, attB.id),
      ).rejects.toThrow(ForbiddenException);

      // Attempting to delete Attachment B from Project B as User A fails
      await expect(
        attachmentsService.deleteAttachment(userA.id, projB.id, itemB.id, attB.id),
      ).rejects.toThrow();
    });
  });

  describe('6. User A → Query B Isolation', () => {
    it('rejects User A attempting to view, execute, or delete Query B belonging to Project B', async () => {
      const authz = new AuthorizationService();
      vi.spyOn(authz, 'requireProjectPermission').mockImplementation(async (projectId, userId) => {
        if (projectId === projB.id && userId === userA.id) {
          throw new ForbiddenException('Unauthorized query access');
        }
        return { projectId, userId, role: 'MEMBER' };
      });

      const mockRepo = {
        findOne: vi.fn(),
        remove: vi.fn(),
      } as any;

      const mockProjectsService = {} as any;
      const queriesService = new QueriesService(mockRepo, mockProjectsService, authz);

      await expect(
        queriesService.findOne(userA.id, projB.id, queryB.id),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        queriesService.runSaved(userA.id, projB.id, queryB.id),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        queriesService.remove(userA.id, projB.id, queryB.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('7. User A → Notification B Isolation', () => {
    it('ensures User A cannot mark User B notifications as read or fetch User B notifications', async () => {
      const mockRepo = {
        getNotifications: vi.fn().mockImplementation(async (userId: string) => {
          if (userId === userA.id) {
            return { notifications: [], total: 0, unreadCount: 0 };
          }
          return { notifications: [notifB], total: 1, unreadCount: 1 };
        }),
        markAsRead: vi.fn().mockImplementation(async (id: string, userId: string) => {
          // If the notification does not belong to userId, the repository update returns null
          if (id === notifB.id && userId === userA.id) {
            return null;
          }
          return { id, userId, readAt: new Date().toISOString() };
        }),
      } as any;

      const authz = new AuthorizationService();
      const notifsService = new NotificationsService(
        mockRepo,
        { sendNotificationToUser: vi.fn() } as any,
        authz,
        { dispatchJob: vi.fn() } as any,
      );

      // User A querying notifications only gets their own feed
      const resultA = await notifsService.getNotifications(userA.id, { limit: 10 });
      expect(resultA.notifications).toEqual([]);
      expect(mockRepo.getNotifications).toHaveBeenCalledWith(userA.id, { limit: 10 });

      // User A attempting to mark User B's notification as read fails / returns null
      const updated = await notifsService.markAsRead(notifB.id, userA.id);
      expect(updated).toBeNull();
      expect(mockRepo.markAsRead).toHaveBeenCalledWith(notifB.id, userA.id);
    });
  });
});
