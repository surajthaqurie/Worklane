import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { GetNotificationsQuery, NotificationDto, NotificationType, UpdateNotificationPreferencesDto } from './dto/notifications.dto.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';
import { db } from '../../db/kysely.js';

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
    private readonly authz: AuthorizationService,
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
   * Phase 14 — Core notification dispatcher with preferences & deduplication
   */
  async createNotification(params: {
    userId: string;
    type: NotificationType | string;
    workItemId?: string | null;
    actorId: string;
    metadata?: Record<string, any>;
    bypassDeduplication?: boolean;
  }): Promise<NotificationDto | null> {
    // Rule 1: Never notify the actor themselves
    if (params.userId === params.actorId) {
      return null;
    }

    try {
      // Rule 2: Check user preferences
      const prefs = await this.repo.getUserPreferences(params.userId);

      if (!prefs.channelInApp) {
        this.logger.debug(`Skipping in-app notification for ${params.userId} as channelInApp is disabled`);
        return null;
      }

      if (params.type === NotificationType.MENTIONED && !prefs.notifyMentions) {
        return null;
      }
      if (params.type === NotificationType.ASSIGNED && !prefs.notifyAssigned) {
        return null;
      }
      if (
        (params.type === NotificationType.WORK_ITEM_UPDATED || params.type === NotificationType.COMMENT_ADDED) &&
        !prefs.notifyFollowed
      ) {
        return null;
      }

      // Rule 3: Deduplication check within a 5-minute window
      if (!params.bypassDeduplication) {
        const recent = await this.repo.findRecentNotification({
          userId: params.userId,
          type: params.type,
          workItemId: params.workItemId,
          actorId: params.actorId,
          withinMinutes: 5,
        });

        if (recent) {
          this.logger.debug(
            `Deduplicated notification for user ${params.userId}, type ${params.type}, workItem ${params.workItemId}`,
          );
          return recent;
        }
      }

      // Rule 4: Create notification record
      const notification = await this.repo.createNotification(params);

      // Rule 5: Dispatch real-time Socket.IO notification to targeted user room
      this.gateway.sendNotificationToUser(params.userId, notification);

      // Rule 6: Email-ready architecture hook
      if (prefs.channelEmail) {
        this.queueEmailNotification(params.userId, notification);
      }

      return notification;
    } catch (err) {
      this.logger.error(`Failed to create notification: ${err}`);
      return null;
    }
  }

  /**
   * Email-ready architecture dispatch hook
   */
  private queueEmailNotification(userId: string, notification: NotificationDto) {
    this.logger.debug(`[Email Service Hook] Queued email notification for user ${userId} (type: ${notification.type})`);
  }

  // ─── Mentions Parser & Validation (Phase 14) ─────────────────────────────

  /**
   * Parses mentions from text and validates candidate users belong to the project.
   * Prevents arbitrary notification targets.
   */
  async parseAndValidateMentions(projectId: string, text: string): Promise<string[]> {
    if (!text || !text.includes('@')) return [];

    // Find all @mentions (usernames, emails, or UUIDs)
    const rawTokens = text.match(/@([a-zA-Z0-9_.%+\-]+)/g) || [];
    if (rawTokens.length === 0) return [];

    const cleanedTokens = rawTokens.map((t) => t.slice(1).toLowerCase());

    // Fetch all members of the target project
    const members = await db
      .selectFrom('project_members as pm')
      .innerJoin('users as u', 'u.id', 'pm.user_id')
      .where('pm.project_id', '=', projectId)
      .select(['u.id', 'u.name', 'u.email'])
      .execute();

    const verifiedUserIds = new Set<string>();

    for (const token of cleanedTokens) {
      for (const m of members) {
        const nameClean = m.name.toLowerCase().replace(/\s+/g, '');
        const emailClean = m.email.toLowerCase();
        const idClean = m.id.toLowerCase();

        if (
          token === m.id ||
          token === idClean ||
          token === emailClean ||
          token === nameClean ||
          nameClean.startsWith(token) ||
          emailClean.startsWith(token)
        ) {
          verifiedUserIds.add(m.id);
        }
      }
    }

    return Array.from(verifiedUserIds);
  }

  // ─── Domain Event Triggers ────────────────────────────────────────────────

  async notifyAssigned(input: BaseNotificationInput & { assignedTo?: string | null }) {
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

  async notifyMentioned(
    input: BaseNotificationInput & {
      mentionedUserIds: string[];
      commentId?: string;
      snippet?: string;
    },
  ) {
    const uniqueUserIds = Array.from(new Set(input.mentionedUserIds)).filter(
      (id) => id && id !== input.actorId,
    );

    const results = await Promise.all(
      uniqueUserIds.map((userId) =>
        this.createNotification({
          userId,
          type: NotificationType.MENTIONED,
          workItemId: input.workItemId,
          actorId: input.actorId,
          metadata: {
            title: input.title,
            key: input.key,
            actorName: input.actorName,
            commentId: input.commentId,
            snippet: input.snippet,
          },
        }),
      ),
    );

    return results.filter(Boolean);
  }

  async notifyWorkItemUpdated(input: BaseNotificationInput & { updatedFields?: string[] }) {
    const followerIds = await this.repo.getFollowerUserIds(input.workItemId);
    const recipients = followerIds.filter((id) => id !== input.actorId);

    const results = await Promise.all(
      recipients.map((userId) =>
        this.createNotification({
          userId,
          type: NotificationType.WORK_ITEM_UPDATED,
          workItemId: input.workItemId,
          actorId: input.actorId,
          metadata: {
            title: input.title,
            key: input.key,
            actorName: input.actorName,
            updatedFields: input.updatedFields,
          },
        }),
      ),
    );

    return results.filter(Boolean);
  }

  async notifyCommentAdded(input: BaseNotificationInput & { commentId: string; snippet: string }) {
    const followerIds = await this.repo.getFollowerUserIds(input.workItemId);
    const recipients = followerIds.filter((id) => id !== input.actorId);

    const results = await Promise.all(
      recipients.map((userId) =>
        this.createNotification({
          userId,
          type: NotificationType.COMMENT_ADDED,
          workItemId: input.workItemId,
          actorId: input.actorId,
          metadata: {
            title: input.title,
            key: input.key,
            actorName: input.actorName,
            commentId: input.commentId,
            snippet: input.snippet,
          },
        }),
      ),
    );

    return results.filter(Boolean);
  }

  async notifyStateChanged(
    input: BaseNotificationInput & {
      assignedTo?: string | null;
      createdBy?: string | null;
      oldState?: string;
      newState: string;
    },
  ) {
    const recipients = Array.from(new Set([input.assignedTo, input.createdBy])).filter(
      (id): id is string => Boolean(id) && id !== input.actorId,
    );

    const results = await Promise.all(
      recipients.map((userId) =>
        this.createNotification({
          userId,
          type: NotificationType.STATE_CHANGED,
          workItemId: input.workItemId,
          actorId: input.actorId,
          metadata: {
            title: input.title,
            key: input.key,
            actorName: input.actorName,
            oldState: input.oldState,
            newState: input.newState,
          },
        }),
      ),
    );

    return results.filter(Boolean);
  }

  async notifyAddedToSprint(
    input: BaseNotificationInput & {
      assignedTo?: string | null;
      createdBy?: string | null;
      iterationId: string;
      sprintName?: string;
    },
  ) {
    if (!input.assignedTo || input.assignedTo === input.actorId) return null;
    return this.createNotification({
      userId: input.assignedTo,
      type: NotificationType.ADDED_TO_SPRINT,
      workItemId: input.workItemId,
      actorId: input.actorId,
      metadata: {
        title: input.title,
        key: input.key,
        actorName: input.actorName,
        iterationId: input.iterationId,
        sprintName: input.sprintName,
      },
    });
  }

  async notifyRemovedFromSprint(
    input: BaseNotificationInput & {
      assignedTo?: string | null;
      createdBy?: string | null;
      previousIterationId?: string | null;
      sprintName?: string;
    },
  ) {
    if (!input.assignedTo || input.assignedTo === input.actorId) return null;
    return this.createNotification({
      userId: input.assignedTo,
      type: NotificationType.REMOVED_FROM_SPRINT,
      workItemId: input.workItemId,
      actorId: input.actorId,
      metadata: {
        title: input.title,
        key: input.key,
        actorName: input.actorName,
        previousIterationId: input.previousIterationId,
        sprintName: input.sprintName,
      },
    });
  }

  async notifyParentChanged(
    input: BaseNotificationInput & {
      assignedTo?: string | null;
      createdBy?: string | null;
      oldParentId?: string | null;
      newParentId?: string | null;
      newParentAssignedTo?: string | null;
    },
  ) {
    const recipients = Array.from(new Set([input.assignedTo, input.newParentAssignedTo])).filter(
      (id): id is string => Boolean(id) && id !== input.actorId,
    );

    const results = await Promise.all(
      recipients.map((userId) =>
        this.createNotification({
          userId,
          type: NotificationType.PARENT_CHANGED,
          workItemId: input.workItemId,
          actorId: input.actorId,
          metadata: {
            title: input.title,
            key: input.key,
            actorName: input.actorName,
            oldParentId: input.oldParentId,
            newParentId: input.newParentId,
          },
        }),
      ),
    );

    return results.filter(Boolean);
  }

  // ─── Followers Management (Phase 14) ──────────────────────────────────────

  async followWorkItem(userId: string, projectId: string, workItemId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_VIEW);

    const item = await db
      .selectFrom('work_items')
      .where('id', '=', workItemId)
      .where('project_id', '=', projectId)
      .select('id')
      .executeTakeFirst();

    if (!item) {
      throw new NotFoundException('Work item not found in project');
    }

    return await this.repo.followWorkItem(userId, workItemId);
  }

  async unfollowWorkItem(userId: string, projectId: string, workItemId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_VIEW);
    return await this.repo.unfollowWorkItem(userId, workItemId);
  }

  async getWorkItemFollowers(userId: string, projectId: string, workItemId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_VIEW);
    return await this.repo.getWorkItemFollowers(workItemId);
  }

  async getFollowStatus(userId: string, projectId: string, workItemId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_VIEW);
    const isFollowing = await this.repo.isFollowing(userId, workItemId);
    const followers = await this.repo.getWorkItemFollowers(workItemId);
    return {
      isFollowing,
      followerCount: followers.length,
    };
  }

  // ─── Notification Preferences (Phase 14) ───────────────────────────────

  async getUserPreferences(userId: string) {
    return await this.repo.getUserPreferences(userId);
  }

  async updateUserPreferences(userId: string, prefs: UpdateNotificationPreferencesDto) {
    return await this.repo.updateUserPreferences(userId, prefs);
  }
}
