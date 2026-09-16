import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { sql } from 'kysely';

@Injectable()
export class WorkItemsRepository {
  async createWorkItem(projectId: string, userId: string, data: any) {
    return await db.transaction().execute(async (trx) => {
      const project = await trx
        .updateTable('projects')
        .set((eb) => ({
          next_work_item_seq: sql<number>`${eb.ref('next_work_item_seq')} + 1`,
        }))
        .where('id', '=', projectId)
        .returning('next_work_item_seq')
        .executeTakeFirstOrThrow();

      const seqNo = project.next_work_item_seq - 1;

      const initialState = await trx
        .selectFrom('work_item_states')
        .where('project_id', '=', projectId)
        .orderBy('sort_order', 'asc')
        .select('key')
        .executeTakeFirst();

      if (!initialState) {
        throw new Error(`No workflow states configured for project ${projectId}`);
      }

      const item = await trx
        .insertInto('work_items')
        .values({
          project_id: projectId,
          seq_no: seqNo,
          parent_id: data.parentId || null,
          type: data.type,
          title: data.title,
          description: data.description || null,
          state: initialState.key,
          priority: data.priority || 'MEDIUM',
          points: data.points || null,
          assigned_to: data.assignedTo || null,
          created_by: userId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('work_item_history')
        .values({
          work_item_id: item.id,
          user_id: userId,
          action: 'CREATED',
        })
        .execute();

      return item;
    });
  }

  async getWorkItems(projectId: string, filters: any) {
    let query = db.selectFrom('work_items').where('project_id', '=', projectId);

    if (filters.state) query = query.where('state', '=', filters.state);
    if (filters.type) query = query.where('type', '=', filters.type);
    if (filters.priority)
      query = query.where('priority', '=', filters.priority);
    if (filters.assignedTo) {
      if (filters.assignedTo === 'UNASSIGNED') {
        query = query.where('assigned_to', 'is', null);
      } else {
        query = query.where('assigned_to', '=', filters.assignedTo);
      }
    }
    if (filters.sprintId && filters.sprintId !== 'undefined') {
      if (filters.sprintId === 'null') {
        query = query.where('sprint_id', 'is', null);
      } else {
        query = query.where('sprint_id', '=', filters.sprintId);
      }
    }

    if (filters.search) {
      const searchStr = String(filters.search).trim();
      query = query.where((eb) => {
        const conditions = [
          eb(
            'search_vector',
            '@@',
            sql`plainto_tsquery('english', ${searchStr})`,
          ),
          eb('title', 'ilike', `%${searchStr}%`),
        ];

        // If search string contains only digits or starts with project key (e.g. "123" or "PROJ-123")
        const seqMatch = searchStr.match(/(?:^[a-zA-Z]+-)?(\d+)$/);
        if (seqMatch) {
          conditions.push(eb('seq_no', '=', parseInt(seqMatch[1], 10)));
        }

        return eb.or(conditions);
      });
    }

    // Minimal pagination representation
    const limit = filters.limit ? parseInt(filters.limit) : 50;
    const offset = filters.offset ? parseInt(filters.offset) : 0;

    return await query
      .selectAll()
      .orderBy('seq_no', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();
  }

  async getProjectStateKeys(projectId: string) {
    const rows = await db
      .selectFrom('work_item_states')
      .where('project_id', '=', projectId)
      .select('key')
      .execute();
    return rows.map((r) => r.key);
  }

  async getWorkItemById(id: string) {
    return await db
      .selectFrom('work_items')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst();
  }

  async updateWorkItem(id: string, userId: string, data: any) {
    return await db.transaction().execute(async (trx) => {
      const oldItem = await trx
        .selectFrom('work_items')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirstOrThrow();

      const states = await trx
        .selectFrom('work_item_states')
        .where('project_id', '=', oldItem.project_id)
        .select(['key', 'is_done'])
        .orderBy('sort_order', 'asc')
        .execute();
      const doneKeys = new Set(states.filter((s) => s.is_done).map((s) => s.key));

      const updateData: any = { updated_at: new Date() };
      if (data.type !== undefined) updateData.type = data.type;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.state !== undefined) {
        updateData.state = data.state;
        updateData.completed_at = doneKeys.has(data.state)
          ? new Date()
          : null;
      }
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.points !== undefined) updateData.points = data.points;
      if (data.assignedTo !== undefined)
        updateData.assigned_to = data.assignedTo;
      if (data.parentId !== undefined) updateData.parent_id = data.parentId;
      if (data.sprintId !== undefined) updateData.sprint_id = data.sprintId;

      const updated = await trx
        .updateTable('work_items')
        .set(updateData)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();

      const trackFields = [
        { key: 'title', dbKey: 'title', action: 'TITLE_CHANGED' },
        { key: 'state', dbKey: 'state', action: 'STATE_CHANGED' },
        { key: 'priority', dbKey: 'priority', action: 'PRIORITY_CHANGED' },
        { key: 'points', dbKey: 'points', action: 'POINTS_CHANGED' },
        { key: 'assignedTo', dbKey: 'assigned_to', action: 'ASSIGNEE_CHANGED' },
        {
          key: 'description',
          dbKey: 'description',
          action: 'DESCRIPTION_CHANGED',
        },
        { key: 'parentId', dbKey: 'parent_id', action: 'PARENT_CHANGED' },
        { key: 'sprintId', dbKey: 'sprint_id', action: 'SPRINT_CHANGED' },
      ];

      for (const field of trackFields) {
        if (
          data[field.key] !== undefined &&
          (oldItem[field.dbKey as keyof typeof oldItem] ?? null) !==
            (updated[field.dbKey as keyof typeof updated] ?? null)
        ) {
          await trx
            .insertInto('work_item_history')
            .values({
              work_item_id: id,
              user_id: userId,
              action: field.action,
              field: field.dbKey,
              old_value: this.stringify(oldItem[field.dbKey as keyof typeof oldItem]),
              new_value: this.stringify(updated[field.dbKey as keyof typeof updated]),
            })
            .execute();
        }
      }

      // Rollup (Azure-style): when every child of a parent is in a done state,
      // move the parent to its done state too.
      const isNewStateDone =
        data.state !== undefined &&
        doneKeys.has(updated.state) &&
        updated.state !== oldItem.state;
      if (isNewStateDone && updated.parent_id && doneKeys.size > 0) {
        const siblings = await trx
          .selectFrom('work_items')
          .where('parent_id', '=', updated.parent_id)
          .where('id', '!=', updated.id)
          .select('state')
          .execute();

        const allChildrenDone =
          siblings.length > 0 && siblings.every((s) => doneKeys.has(s.state));
        if (allChildrenDone) {
          const parent = await trx
            .selectFrom('work_items')
            .where('id', '=', updated.parent_id)
            .selectAll()
            .executeTakeFirst();
          const parentDoneKey = [...doneKeys][0];
          if (parent && parentDoneKey && parent.state !== parentDoneKey) {
            await trx
              .updateTable('work_items')
              .set({
                state: parentDoneKey,
                completed_at: new Date(),
                updated_at: new Date(),
              })
              .where('id', '=', parent.id)
              .execute();

            await trx
              .insertInto('work_item_history')
              .values({
                work_item_id: parent.id,
                user_id: userId,
                action: 'STATE_CHANGED',
                field: 'state',
                old_value: parent.state,
                new_value: parentDoneKey,
              })
              .execute();
          }
        }
      }

      return updated;
    });
  }

  private stringify(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return String(value);
  }

  async deleteWorkItem(id: string, userId: string) {
    return await db.transaction().execute(async (trx) => {
      const item = await trx
        .selectFrom('work_items')
        .where('id', '=', id)
        .select(['id', 'title'])
        .executeTakeFirst();

      // Immutable audit record survives deletion (history FK is ON DELETE SET NULL)
      await trx
        .insertInto('work_item_history')
        .values({
          work_item_id: id,
          user_id: userId,
          action: 'DELETED',
          old_value: item?.title ?? null,
        })
        .execute();

      await trx.deleteFrom('work_items').where('id', '=', id).execute();
    });
  }

  async getComments(workItemId: string) {
    return await db
      .selectFrom('work_item_comments')
      .innerJoin('users', 'users.id', 'work_item_comments.user_id')
      .where('work_item_id', '=', workItemId)
      .select([
        'work_item_comments.id',
        'work_item_comments.content',
        'work_item_comments.created_at',
        'work_item_comments.updated_at',
        'work_item_comments.user_id',
        'users.name as user_name',
        'users.avatar_url as user_avatar_url',
      ])
      .orderBy('work_item_comments.created_at', 'asc')
      .execute();
  }

  async createComment(workItemId: string, userId: string, content: string) {
    return await db
      .insertInto('work_item_comments')
      .values({ work_item_id: workItemId, user_id: userId, content })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateComment(commentId: string, userId: string, content: string) {
    return await db
      .updateTable('work_item_comments')
      .set({ content, updated_at: new Date() })
      .where('id', '=', commentId)
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async deleteComment(commentId: string, userId: string) {
    return await db
      .deleteFrom('work_item_comments')
      .where('id', '=', commentId)
      .where('user_id', '=', userId)
      .execute();
  }

  async getActivity(workItemId: string) {
    return await db
      .selectFrom('work_item_history')
      .innerJoin('users', 'users.id', 'work_item_history.user_id')
      .where('work_item_id', '=', workItemId)
      .select([
        'work_item_history.id',
        'work_item_history.action',
        'work_item_history.field',
        'work_item_history.old_value',
        'work_item_history.new_value',
        'work_item_history.created_at',
        'work_item_history.user_id',
        'users.name as user_name',
        'users.avatar_url as user_avatar_url',
      ])
      .orderBy('work_item_history.created_at', 'desc')
      .execute();
  }
}
