import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { GetNotificationsQuery, NotificationDto, NotificationPreferencesDto } from './dto/notifications.dto.js';
import { sql } from 'kysely';

@Injectable()
export class NotificationsRepository {
  async createNotification(data: {
    userId: string;
    type: string;
    workItemId?: string | null;
    actorId: string;
    metadata?: Record<string, any>;
  }): Promise<NotificationDto> {
    const row = await db
      .insertInto('notifications')
      .values({
        user_id: data.userId,
        type: data.type,
        work_item_id: data.workItemId ?? null,
        actor_id: data.actorId,
        metadata: JSON.stringify(data.metadata ?? {}),
        read_at: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToDto(row);
  }

  /**
   * Phase 14 — Deduplication check: Find unread notification for same user, actor, type, work item within window
   */
  async findRecentNotification(data: {
    userId: string;
    type: string;
    workItemId?: string | null;
    actorId: string;
    withinMinutes?: number;
  }): Promise<NotificationDto | null> {
    const minutes = data.withinMinutes ?? 5;

    let query = db
      .selectFrom('notifications')
      .where('user_id', '=', data.userId)
      .where('type', '=', data.type)
      .where('actor_id', '=', data.actorId)
      .where('read_at', 'is', null)
      .where(
        'created_at',
        '>',
        sql<Date>`CURRENT_TIMESTAMP - INTERVAL '${sql.raw(minutes.toString())} minutes'`,
      );

    if (data.workItemId) {
      query = query.where('work_item_id', '=', data.workItemId);
    } else {
      query = query.where('work_item_id', 'is', null);
    }

    const row = await query
      .orderBy('created_at', 'desc')
      .selectAll()
      .executeTakeFirst();

    return row ? this.mapToDto(row) : null;
  }

  async getNotifications(userId: string, query: GetNotificationsQuery) {
    let q = db
      .selectFrom('notifications as n')
      .innerJoin('users as actor', 'actor.id', 'n.actor_id')
      .leftJoin('work_items as wi', 'wi.id', 'n.work_item_id')
      .leftJoin('projects as p', 'p.id', 'wi.project_id')
      .where('n.user_id', '=', userId)
      .select([
        'n.id',
        'n.user_id',
        'n.type',
        'n.work_item_id',
        'n.actor_id',
        'n.metadata',
        'n.read_at',
        'n.created_at',
        'actor.name as actor_name',
        'p.key as project_key',
        'wi.seq_no as work_item_seq',
        'wi.title as work_item_title',
        'wi.project_id',
      ]);

    if (query.unreadOnly) {
      q = q.where('n.read_at', 'is', null);
    }

    if (query.cursor) {
      const cursorRow = await db
        .selectFrom('notifications')
        .where('id', '=', query.cursor)
        .select(['created_at', 'id'])
        .executeTakeFirst();

      if (cursorRow) {
        q = q.where((eb) =>
          eb.or([
            eb('n.created_at', '<', cursorRow.created_at),
            eb.and([
              eb('n.created_at', '=', cursorRow.created_at),
              eb('n.id', '<', cursorRow.id),
            ]),
          ]),
        );
      }
    }

    const limit = query.limit ?? 20;
    const items = await q
      .orderBy('n.created_at', 'desc')
      .orderBy('n.id', 'desc')
      .limit(limit + 1)
      .execute();

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1].id : null;

    const unreadCount = await this.getUnreadCount(userId);

    return {
      notifications: pageItems.map((item) => this.mapToDto(item)),
      unreadCount,
      nextCursor,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await db
      .selectFrom('notifications')
      .where('user_id', '=', userId)
      .where('read_at', 'is', null)
      .select((eb) => eb.fn.count<string>('id').as('count'))
      .executeTakeFirst();

    return parseInt(result?.count ?? '0', 10);
  }

  async markAsRead(id: string, userId: string): Promise<NotificationDto | null> {
    const updated = await db
      .updateTable('notifications')
      .set({ read_at: new Date() })
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();

    return updated ? this.mapToDto(updated) : null;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await db
      .updateTable('notifications')
      .set({ read_at: new Date() })
      .where('user_id', '=', userId)
      .where('read_at', 'is', null)
      .returning('id')
      .execute();

    return result.length;
  }

  // ─── Followers Engine (Phase 14) ──────────────────────────────────────────

  async followWorkItem(userId: string, workItemId: string) {
    await db
      .insertInto('work_item_followers')
      .values({
        work_item_id: workItemId,
        user_id: userId,
      })
      .onConflict((oc) => oc.doNothing())
      .execute();

    return { success: true, isFollowing: true };
  }

  async unfollowWorkItem(userId: string, workItemId: string) {
    await db
      .deleteFrom('work_item_followers')
      .where('work_item_id', '=', workItemId)
      .where('user_id', '=', userId)
      .execute();

    return { success: true, isFollowing: false };
  }

  async isFollowing(userId: string, workItemId: string): Promise<boolean> {
    const row = await db
      .selectFrom('work_item_followers')
      .where('work_item_id', '=', workItemId)
      .where('user_id', '=', userId)
      .select('user_id')
      .executeTakeFirst();

    return Boolean(row);
  }

  async getWorkItemFollowers(workItemId: string) {
    const rows = await db
      .selectFrom('work_item_followers as f')
      .innerJoin('users as u', 'u.id', 'f.user_id')
      .where('f.work_item_id', '=', workItemId)
      .select(['u.id', 'u.name', 'u.email', 'u.avatar_url', 'f.created_at'])
      .orderBy('f.created_at', 'asc')
      .execute();

    return rows.map((r) => ({
      userId: r.id,
      name: r.name,
      email: r.email,
      avatarUrl: r.avatar_url,
      followedAt: r.created_at,
    }));
  }

  async getFollowerUserIds(workItemId: string): Promise<string[]> {
    const rows = await db
      .selectFrom('work_item_followers')
      .where('work_item_id', '=', workItemId)
      .select('user_id')
      .execute();

    return rows.map((r) => r.user_id);
  }

  // ─── Notification Preferences Engine (Phase 14) ─────────────────────────

  async getUserPreferences(userId: string): Promise<NotificationPreferencesDto> {
    let row = await db
      .selectFrom('user_notification_preferences')
      .where('user_id', '=', userId)
      .selectAll()
      .executeTakeFirst();

    if (!row) {
      row = await db
        .insertInto('user_notification_preferences')
        .values({
          user_id: userId,
          channel_in_app: true,
          channel_email: true,
          notify_mentions: true,
          notify_assigned: true,
          notify_followed: true,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    return {
      userId: row.user_id,
      channelInApp: Boolean(row.channel_in_app),
      channelEmail: Boolean(row.channel_email),
      notifyMentions: Boolean(row.notify_mentions),
      notifyAssigned: Boolean(row.notify_assigned),
      notifyFollowed: Boolean(row.notify_followed),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  async updateUserPreferences(
    userId: string,
    prefs: {
      channelInApp?: boolean;
      channelEmail?: boolean;
      notifyMentions?: boolean;
      notifyAssigned?: boolean;
      notifyFollowed?: boolean;
    },
  ): Promise<NotificationPreferencesDto> {
    const existing = await this.getUserPreferences(userId);

    const updated = await db
      .updateTable('user_notification_preferences')
      .set({
        channel_in_app: prefs.channelInApp ?? existing.channelInApp,
        channel_email: prefs.channelEmail ?? existing.channelEmail,
        notify_mentions: prefs.notifyMentions ?? existing.notifyMentions,
        notify_assigned: prefs.notifyAssigned ?? existing.notifyAssigned,
        notify_followed: prefs.notifyFollowed ?? existing.notifyFollowed,
        updated_at: new Date(),
      })
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      userId: updated.user_id,
      channelInApp: Boolean(updated.channel_in_app),
      channelEmail: Boolean(updated.channel_email),
      notifyMentions: Boolean(updated.notify_mentions),
      notifyAssigned: Boolean(updated.notify_assigned),
      notifyFollowed: Boolean(updated.notify_followed),
      createdAt: updated.created_at ? new Date(updated.created_at).toISOString() : new Date().toISOString(),
      updatedAt: updated.updated_at ? new Date(updated.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  private mapToDto(row: any): NotificationDto {
    let metadata: any = {};
    if (typeof row.metadata === 'string') {
      try {
        metadata = JSON.parse(row.metadata);
      } catch {
        metadata = {};
      }
    } else if (typeof row.metadata === 'object' && row.metadata !== null) {
      metadata = row.metadata;
    }

    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      workItemId: row.work_item_id,
      actorId: row.actor_id,
      actorName: row.actor_name ?? undefined,
      projectId: row.project_id ?? null,
      workItemKey:
        row.project_key != null && row.work_item_seq != null
          ? `${row.project_key}-${row.work_item_seq}`
          : undefined,
      workItemTitle: row.work_item_title ?? undefined,
      metadata,
      readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }
}
