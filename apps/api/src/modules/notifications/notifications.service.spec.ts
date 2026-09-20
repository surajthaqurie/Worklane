import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service.js';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { NotificationType } from './dto/notifications.dto.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: any;
  let gateway: any;

  const mockNotif = {
    id: 'n-1',
    userId: 'user-1',
    type: NotificationType.ASSIGNED,
    workItemId: 'wi-1',
    actorId: 'actor-1',
    metadata: { title: 'Test Work Item' },
    readAt: null,
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    repo = {
      createNotification: vi.fn().mockResolvedValue(mockNotif),
      findRecentNotification: vi.fn().mockResolvedValue(null),
      getUserPreferences: vi.fn().mockResolvedValue({
        userId: 'user-1',
        channelInApp: true,
        channelEmail: true,
        notifyMentions: true,
        notifyAssigned: true,
        notifyFollowed: true,
      }),
      getNotifications: vi.fn().mockResolvedValue({
        notifications: [mockNotif],
        unreadCount: 1,
        nextCursor: null,
      }),
      getUnreadCount: vi.fn().mockResolvedValue(1),
      markAsRead: vi.fn().mockResolvedValue({ ...mockNotif, readAt: new Date().toISOString() }),
      markAllAsRead: vi.fn().mockResolvedValue(1),
      getFollowerUserIds: vi.fn().mockResolvedValue([]),
    };

    gateway = {
      sendNotificationToUser: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: repo },
        { provide: NotificationsGateway, useValue: gateway },
        {
          provide: 'AuthorizationService',
          useValue: { requireProjectPermission: vi.fn().mockResolvedValue(true) },
        },
        {
          provide: Symbol.for('AuthorizationService'),
          useValue: { requireProjectPermission: vi.fn().mockResolvedValue(true) },
        },
      ],
    })
      .overrideProvider(NotificationsService)
      .useValue(new NotificationsService(repo, gateway, { requireProjectPermission: vi.fn().mockResolvedValue(true) } as any))
      .compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should create notification and send socket event when recipient is not the actor', async () => {
    const res = await service.createNotification({
      userId: 'user-1',
      type: NotificationType.ASSIGNED,
      workItemId: 'wi-1',
      actorId: 'actor-1',
      metadata: { title: 'Test Item' },
    });

    expect(repo.createNotification).toHaveBeenCalled();
    expect(gateway.sendNotificationToUser).toHaveBeenCalledWith('user-1', mockNotif);
    expect(res).toBe(mockNotif);
  });

  it('should NOT create notification when recipient is the actor', async () => {
    const res = await service.createNotification({
      userId: 'user-1',
      type: NotificationType.ASSIGNED,
      workItemId: 'wi-1',
      actorId: 'user-1', // actor = recipient
      metadata: { title: 'Test Item' },
    });

    expect(repo.createNotification).not.toHaveBeenCalled();
    expect(gateway.sendNotificationToUser).not.toHaveBeenCalled();
    expect(res).toBeNull();
  });

  it('should handle notifyAssigned', async () => {
    await service.notifyAssigned({
      actorId: 'actor-1',
      workItemId: 'wi-1',
      title: 'Task A',
      key: 'PROJ-1',
      assignedTo: 'user-1',
    });

    expect(repo.createNotification).toHaveBeenCalledWith({
      userId: 'user-1',
      type: NotificationType.ASSIGNED,
      workItemId: 'wi-1',
      actorId: 'actor-1',
      metadata: { title: 'Task A', key: 'PROJ-1', actorName: undefined },
    });
  });

  it('should handle notifyMentioned for multiple users', async () => {
    await service.notifyMentioned({
      actorId: 'actor-1',
      workItemId: 'wi-1',
      title: 'Task A',
      commentId: 'c-1',
      snippet: 'Hey @user1 @user2',
      mentionedUserIds: ['user-1', 'user-2', 'actor-1'],
    });

    // Should not notify actor-1
    expect(repo.createNotification).toHaveBeenCalledTimes(2);
  });

  it('should handle notifyStateChanged', async () => {
    await service.notifyStateChanged({
      actorId: 'actor-1',
      workItemId: 'wi-1',
      title: 'Task A',
      assignedTo: 'user-1',
      createdBy: 'user-2',
      oldState: 'New',
      newState: 'Active',
    });

    expect(repo.createNotification).toHaveBeenCalledTimes(2);
  });

  it('should handle notifyAddedToSprint and notifyRemovedFromSprint', async () => {
    await service.notifyAddedToSprint({
      actorId: 'actor-1',
      workItemId: 'wi-1',
      title: 'Task A',
      assignedTo: 'user-1',
      iterationId: 'it-1',
      sprintName: 'Sprint 1',
    });
    expect(repo.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: NotificationType.ADDED_TO_SPRINT }),
    );

    await service.notifyRemovedFromSprint({
      actorId: 'actor-1',
      workItemId: 'wi-1',
      title: 'Task A',
      assignedTo: 'user-1',
      previousIterationId: 'it-1',
      sprintName: 'Sprint 1',
    });
    expect(repo.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: NotificationType.REMOVED_FROM_SPRINT }),
    );
  });

  it('should handle notifyParentChanged', async () => {
    await service.notifyParentChanged({
      actorId: 'actor-1',
      workItemId: 'wi-1',
      title: 'Task A',
      assignedTo: 'user-1',
      oldParentId: null,
      newParentId: 'p-1',
      newParentAssignedTo: 'user-2',
    });

    expect(repo.createNotification).toHaveBeenCalledTimes(2);
  });

  it('should get unread count', async () => {
    const res = await service.getUnreadCount('user-1');
    expect(res).toEqual({ unreadCount: 1 });
  });

  it('should mark single and all notifications read', async () => {
    await service.markAsRead('n-1', 'user-1');
    expect(repo.markAsRead).toHaveBeenCalledWith('n-1', 'user-1');

    await service.markAllAsRead('user-1');
    expect(repo.markAllAsRead).toHaveBeenCalledWith('user-1');
  });
});
