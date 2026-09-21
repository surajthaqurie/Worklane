import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { NotificationType } from './dto/notifications.dto.js';
import { ForbiddenException } from '@nestjs/common';

describe('Followers, Mentions & Deduplication unit tests (Phase 14)', () => {
  let service: NotificationsService;
  let repo: any;
  let gateway: any;
  let authz: any;

  beforeEach(() => {
    repo = {
      createNotification: vi.fn(),
      findRecentNotification: vi.fn(),
      getNotifications: vi.fn(),
      getUnreadCount: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      followWorkItem: vi.fn(),
      unfollowWorkItem: vi.fn(),
      isFollowing: vi.fn(),
      getWorkItemFollowers: vi.fn(),
      getFollowerUserIds: vi.fn().mockResolvedValue([]),
      getUserPreferences: vi.fn().mockResolvedValue({
        userId: 'user-1',
        channelInApp: true,
        channelEmail: true,
        notifyMentions: true,
        notifyAssigned: true,
        notifyFollowed: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      updateUserPreferences: vi.fn(),
    } as any;

    gateway = {
      sendNotificationToUser: vi.fn(),
    } as any;

    authz = {
      requireProjectPermission: vi.fn().mockResolvedValue(true),
    };

    service = new NotificationsService(repo, gateway, authz, {
      dispatchJob: vi.fn().mockResolvedValue({ job: {}, isDuplicate: false }),
    } as any);
  });

  describe('Notification Creation & Deduplication', () => {
    it('should never create a notification targeting the actor themselves', async () => {
      const res = await service.createNotification({
        userId: 'user-1',
        actorId: 'user-1',
        type: NotificationType.ASSIGNED,
        workItemId: 'item-1',
      });

      expect(res).toBeNull();
      expect(repo.createNotification).not.toHaveBeenCalled();
    });

    it('should deduplicate repeated notifications within the time window', async () => {
      const existingNotification = {
        id: 'existing-notif-id',
        userId: 'user-1',
        actorId: 'actor-1',
        type: NotificationType.ASSIGNED,
        workItemId: 'item-1',
        metadata: {},
        readAt: null,
        createdAt: new Date().toISOString(),
      };

      repo.findRecentNotification.mockResolvedValueOnce(existingNotification as any);

      const res = await service.createNotification({
        userId: 'user-1',
        actorId: 'actor-1',
        type: NotificationType.ASSIGNED,
        workItemId: 'item-1',
      });

      expect(res).toEqual(existingNotification);
      expect(repo.createNotification).not.toHaveBeenCalled();
    });

    it('should respect user preferences and skip in-app notification when disabled', async () => {
      repo.getUserPreferences.mockResolvedValueOnce({
        userId: 'user-1',
        channelInApp: false, // Disabled
        channelEmail: true,
        notifyMentions: true,
        notifyAssigned: true,
        notifyFollowed: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await service.createNotification({
        userId: 'user-1',
        actorId: 'actor-1',
        type: NotificationType.ASSIGNED,
        workItemId: 'item-1',
      });

      expect(res).toBeNull();
      expect(repo.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('Real-time Gateway Targeting', () => {
    it('should emit notification to specific user room via Gateway', async () => {
      const newNotif = {
        id: 'notif-100',
        userId: 'user-2',
        actorId: 'actor-1',
        type: NotificationType.ASSIGNED,
        workItemId: 'item-1',
        metadata: { title: 'Test Task' },
        readAt: null,
        createdAt: new Date().toISOString(),
      };

      repo.findRecentNotification.mockResolvedValueOnce(null);
      repo.createNotification.mockResolvedValueOnce(newNotif as any);

      await service.createNotification({
        userId: 'user-2',
        actorId: 'actor-1',
        type: NotificationType.ASSIGNED,
        workItemId: 'item-1',
      });

      expect(gateway.sendNotificationToUser).toHaveBeenCalledWith('user-2', newNotif);
    });
  });

  describe('Followers System Permissions', () => {
    it('should check WORK_ITEM_VIEW permission on follow work item', async () => {
      authz.requireProjectPermission.mockRejectedValueOnce(new ForbiddenException('Access Denied'));

      await expect(
        service.followWorkItem('user-1', 'proj-1', 'item-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
