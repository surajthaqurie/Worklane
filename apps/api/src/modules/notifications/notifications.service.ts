import { Injectable, Logger } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { GetNotificationsQuery, NotificationDto, NotificationType } from './dto/notifications.dto.js';

export interface BaseNotificationInput {
  actorId: string;
  workItemId: string;
  title: string;
  key?: string;
  actorName?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly gateway: NotificationsGateway,
  ) {}

  async getNotifications(userId: string, query: GetNotificationsQuery) {
    return this.repo.getNotifications(userId, query);
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.repo.getUnreadCount(userId);
    return { unreadCount };
  }

  async markAsRead(id: string, userId: string) {
    const updated = await this.repo.markAsRead(id, userId);
    return updated;
  }

  async markAllAsRead(userId: string) {
    const count = await this.repo.markAllAsRead(userId);
    return { success: true, count };
  }

  /**
   * Core helper to create a notification and push via socket
   */
  async createNotification(params: {
    userId: string;
    type: NotificationType | string;
    workItemId?: string | null;
    actorId: string;
    metadata?: Record<string, any>;
  }): Promise<NotificationDto | null> {
    // Rule: Do not notify the actor themselves
    if (params.userId === params.actorId) {
      return null;
    }

    try {
      const notification = await this.repo.createNotification(params);
      this.gateway.sendNotificationToUser(params.userId, notification);
      return notification;
    } catch (err) {
      this.logger.error(`Failed to create notification: ${err}`);
      return null;
    }
  }

  // ─── Domain Event Triggers ────────────────────────────────────────────────

  /**
   * Triggered when a work item is assigned or reassigned to a user
   */
  async notifyAssigned(input: BaseNotificationInput & { assignedTo: string }) {
    if (!input.assignedTo) return;
    return this.createNotification({
      userId: input.assignedTo,
      type: NotificationType.ASSIGNED,
      workItemId: input.workItemId,
      actorId: input.actorId,
      metadata: {
        title: input.title,
        key: input.key,
        actorName: input.actorName,
      },
    });
  }

  /**
   * Triggered when a comment mentions one or more users
   */
  async notifyMentioned(
    input: BaseNotificationInput & {
      mentionedUserIds: string[];
      commentId: string;
      snippet: string;
    },
  ) {
    const uniqueUserIds = Array.from(new Set(input.mentionedUserIds)).filter(
      (id) => id && id !== input.actorId,
    );

    const results: NotificationDto[] = [];
    for (const userId of uniqueUserIds) {
      const notif = await this.createNotification({
        userId,
        type: NotificationType.MENTIONED,
        workItemId: input.workItemId,
        actorId: input.actorId,
        metadata: {
          title: input.title,
          key: input.key,
          commentId: input.commentId,
          snippet: input.snippet,
          actorName: input.actorName,
        },
      });
      if (notif) results.push(notif);
    }
    return results;
  }

  /**
   * Triggered when work item state changes (e.g. New -> Active)
   */
  async notifyStateChanged(
    input: BaseNotificationInput & {
      assignedTo?: string | null;
      createdBy?: string | null;
      oldState: string;
      newState: string;
    },
  ) {
    const recipients = new Set<string>();
    if (input.assignedTo) recipients.add(input.assignedTo);
    if (input.createdBy) recipients.add(input.createdBy);

    recipients.delete(input.actorId);

    const results: NotificationDto[] = [];
    for (const userId of recipients) {
      const notif = await this.createNotification({
        userId,
        type: NotificationType.STATE_CHANGED,
        workItemId: input.workItemId,
        actorId: input.actorId,
        metadata: {
          title: input.title,
          key: input.key,
          oldState: input.oldState,
          newState: input.newState,
          actorName: input.actorName,
        },
      });
      if (notif) results.push(notif);
    }
    return results;
  }

  /**
   * Triggered when work item is added to a sprint/iteration
   */
  async notifyAddedToSprint(
    input: BaseNotificationInput & {
      assignedTo?: string | null;
      createdBy?: string | null;
      iterationId: string;
      sprintName?: string;
    },
  ) {
    const recipients = new Set<string>();
    if (input.assignedTo) recipients.add(input.assignedTo);
    if (input.createdBy) recipients.add(input.createdBy);

    recipients.delete(input.actorId);

    const results: NotificationDto[] = [];
    for (const userId of recipients) {
      const notif = await this.createNotification({
        userId,
        type: NotificationType.ADDED_TO_SPRINT,
        workItemId: input.workItemId,
        actorId: input.actorId,
        metadata: {
          title: input.title,
          key: input.key,
          iterationId: input.iterationId,
          sprintName: input.sprintName,
          actorName: input.actorName,
        },
      });
      if (notif) results.push(notif);
    }
    return results;
  }

  /**
   * Triggered when work item is removed from a sprint/iteration
   */
  async notifyRemovedFromSprint(
    input: BaseNotificationInput & {
      assignedTo?: string | null;
      createdBy?: string | null;
      previousIterationId?: string | null;
      sprintName?: string;
    },
  ) {
    const recipients = new Set<string>();
    if (input.assignedTo) recipients.add(input.assignedTo);
    if (input.createdBy) recipients.add(input.createdBy);

    recipients.delete(input.actorId);

    const results: NotificationDto[] = [];
    for (const userId of recipients) {
      const notif = await this.createNotification({
        userId,
        type: NotificationType.REMOVED_FROM_SPRINT,
        workItemId: input.workItemId,
        actorId: input.actorId,
        metadata: {
          title: input.title,
          key: input.key,
          previousIterationId: input.previousIterationId,
          sprintName: input.sprintName,
          actorName: input.actorName,
        },
      });
      if (notif) results.push(notif);
    }
    return results;
  }

  /**
   * Triggered when parent/child relationship changes
   */
  async notifyParentChanged(
    input: BaseNotificationInput & {
      assignedTo?: string | null;
      createdBy?: string | null;
      oldParentId?: string | null;
      newParentId?: string | null;
      newParentAssignedTo?: string | null;
    },
  ) {
    const recipients = new Set<string>();
    if (input.assignedTo) recipients.add(input.assignedTo);
    if (input.createdBy) recipients.add(input.createdBy);
    if (input.newParentAssignedTo) recipients.add(input.newParentAssignedTo);

    recipients.delete(input.actorId);

    const results: NotificationDto[] = [];
    for (const userId of recipients) {
      const notif = await this.createNotification({
        userId,
        type: NotificationType.PARENT_CHANGED,
        workItemId: input.workItemId,
        actorId: input.actorId,
        metadata: {
          title: input.title,
          key: input.key,
          oldParentId: input.oldParentId,
          newParentId: input.newParentId,
          actorName: input.actorName,
        },
      });
      if (notif) results.push(notif);
    }
    return results;
  }
}
