import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { GetNotificationsQuery, NotificationDto } from './dto/notifications.dto.js';

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

  async getNotifications(userId: string, query: GetNotificationsQuery) {
    let q = db
      .selectFrom('notifications')
      .where('user_id', '=', userId);

    if (query.unreadOnly) {
      q = q.where('read_at', 'is', null);
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
            eb('notifications.created_at', '<', cursorRow.created_at),
            eb.and([
              eb('notifications.created_at', '=', cursorRow.created_at),
              eb('notifications.id', '<', cursorRow.id),
            ]),
          ]),
        );
      }
    }

    const limit = query.limit ?? 20;
    const items = await q
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1)
      .selectAll()
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
      .executeTakeFirst();

    return Number(result.numUpdatedRows ?? 0);
  }

  private mapToDto(row: any): NotificationDto {
    let parsedMetadata = row.metadata;
    if (typeof parsedMetadata === 'string') {
      try {
        parsedMetadata = JSON.parse(parsedMetadata);
      } catch {
        parsedMetadata = {};
      }
    }
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      workItemId: row.work_item_id,
      actorId: row.actor_id,
      metadata: parsedMetadata ?? {},
      readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}
