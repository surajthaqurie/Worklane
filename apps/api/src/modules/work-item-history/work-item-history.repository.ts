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
  async findByWorkItemId(workItemId: string): Promise<HistoryRowWithActor[]> {
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
      .execute();
  }
}