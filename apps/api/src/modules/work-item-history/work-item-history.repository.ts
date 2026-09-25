import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { Database } from '../../db/kysely.js';
import { Kysely, Transaction } from 'kysely';

export type HistoryExecutor = Kysely<Database> | Transaction<Database>;

export interface StoredHistoryRow {
  id: string;
  work_item_id: string;
  user_id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: Date;
}

export interface HistoryRowWithActor extends StoredHistoryRow {
  user_name: string;
  user_avatar_url: string | null;
}

export interface HistoryWrite {
  work_item_id: string;
  user_id: string;
  action: string;
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
}

export interface HistoryQueryFilters {
  actorId?: string;
  field?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

@Injectable()
export class WorkItemHistoryRepository {
  async insertMany(executor: HistoryExecutor, rows: HistoryWrite[]): Promise<void> {
    if (rows.length === 0) return;
    await executor
      .insertInto('work_item_history')
      .values(
        rows.map((r) => ({
          work_item_id: r.work_item_id,
          user_id: r.user_id,
          action: r.action,
          field: r.field ?? null,
          old_value: r.old_value ?? null,
          new_value: r.new_value ?? null,
        })),
      )
      .execute();
  }

  /** Returns the immutable history for one work item, oldest first. */
  async findByWorkItemId(workItemId: string, limit: number = 100): Promise<HistoryRowWithActor[]> {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    return await db
      .selectFrom('work_item_history')
      .innerJoin('users', 'users.id', 'work_item_history.user_id')
      .where('work_item_id', '=', workItemId)
      .select([
        'work_item_history.id',
        'work_item_history.work_item_id',
        'work_item_history.user_id',
        'work_item_history.action',
        'work_item_history.field',
        'work_item_history.old_value',
        'work_item_history.new_value',
        'work_item_history.created_at',
        'users.name as user_name',
        'users.avatar_url as user_avatar_url',
      ])
      .orderBy('work_item_history.inserted_at', 'asc')
      .orderBy('work_item_history.id', 'asc')
      .limit(safeLimit)
      .execute();
  }

  /** Returns paginated history with filtering by actor, field, and date range. */
  async findWithPaginationAndFilters(
    workItemId: string,
    filters: HistoryQueryFilters = {},
  ): Promise<{ rows: HistoryRowWithActor[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, filters.page || 1);
    // Never load unlimited history: enforce hard upper limit of 100
    const limit = Math.min(Math.max(1, filters.limit || 20), 100);
    const offset = (page - 1) * limit;

    let baseQuery = db
      .selectFrom('work_item_history')
      .innerJoin('users', 'users.id', 'work_item_history.user_id')
      .where('work_item_id', '=', workItemId);

    if (filters.actorId) {
      baseQuery = baseQuery.where('work_item_history.user_id', '=', filters.actorId);
    }

    if (filters.field) {
      baseQuery = baseQuery.where('work_item_history.field', '=', filters.field);
    }

    if (filters.startDate) {
      baseQuery = baseQuery.where('work_item_history.created_at', '>=', new Date(filters.startDate));
    }

    if (filters.endDate) {
      baseQuery = baseQuery.where('work_item_history.created_at', '<=', new Date(filters.endDate));
    }

    // Total count for pagination metadata
    const countResult = await baseQuery
      .select(db.fn.count<string>('work_item_history.id').as('count'))
      .executeTakeFirst();
    const total = countResult ? parseInt(countResult.count, 10) : 0;

    const orderDirection = filters.order === 'asc' ? 'asc' : 'desc';

    const rows = await baseQuery
      .select([
        'work_item_history.id',
        'work_item_history.work_item_id',
        'work_item_history.user_id',
        'work_item_history.action',
        'work_item_history.field',
        'work_item_history.old_value',
        'work_item_history.new_value',
        'work_item_history.created_at',
        'users.name as user_name',
        'users.avatar_url as user_avatar_url',
      ])
      .orderBy('work_item_history.inserted_at', orderDirection)
      .orderBy('work_item_history.id', orderDirection)
      .limit(limit)
      .offset(offset)
      .execute();

    return { rows, total, page, limit };
  }
}