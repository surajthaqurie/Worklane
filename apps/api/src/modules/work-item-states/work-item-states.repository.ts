import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';

@Injectable()
export class WorkItemStatesRepository {
  async findAll(projectId: string) {
    const rows = await db
      .selectFrom('work_item_states')
      .where('project_id', '=', projectId)
      .orderBy('sort_order', 'asc')
      .selectAll()
      .execute();
    return rows.map((r) => this.mapToCamelCase(r));
  }

  async findByKey(projectId: string, key: string) {
    const row = await db
      .selectFrom('work_item_states')
      .where('project_id', '=', projectId)
      .where('key', '=', key)
      .selectAll()
      .executeTakeFirst();
    if (!row) return null;
    return this.mapToCamelCase(row);
  }

  async findById(id: string) {
    const row = await db
      .selectFrom('work_item_states')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst();
    if (!row) return null;
    return this.mapToCamelCase(row);
  }

  async create(projectId: string, data: { name: string; key: string; color: string; isDone: boolean }) {
    const maxOrder = await db
      .selectFrom('work_item_states')
      .where('project_id', '=', projectId)
      .select('sort_order')
      .orderBy('sort_order', 'desc')
      .limit(1)
      .executeTakeFirst();

    const row = await db
      .insertInto('work_item_states')
      .values({
        project_id: projectId,
        name: data.name,
        key: data.key,
        color: data.color,
        is_done: data.isDone,
        sort_order: (maxOrder?.sort_order ?? -1) + 1,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToCamelCase(row);
  }

  async update(id: string, data: { name?: string; color?: string; isDone?: boolean; sortOrder?: number }) {
    const updateData: any = { updated_at: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.isDone !== undefined) updateData.is_done = data.isDone;
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;

    const row = await db
      .updateTable('work_item_states')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToCamelCase(row);
  }

  async remove(id: string) {
    await db.deleteFrom('work_item_states').where('id', '=', id).execute();
  }

  async countByProject(projectId: string) {
    const result = await db
      .selectFrom('work_item_states')
      .where('project_id', '=', projectId)
      .select(db.fn.countAll().as('count'))
      .executeTakeFirstOrThrow();
    return Number(result.count);
  }

  async findDoneKey(projectId: string) {
    const row = await db
      .selectFrom('work_item_states')
      .where('project_id', '=', projectId)
      .where('is_done', '=', true)
      .orderBy('sort_order', 'asc')
      .select('key')
      .executeTakeFirst();
    return row?.key ?? null;
  }

  async reassignWorkItemsToState(projectId: string, fromKey: string, toKey: string) {
    await db
      .updateTable('work_items')
      .set({ state: toKey, updated_at: new Date() })
      .where('project_id', '=', projectId)
      .where('state', '=', fromKey)
      .execute();
  }

  async findWorkItemsInState(projectId: string, stateKey: string) {
    return await db
      .selectFrom('work_items')
      .where('project_id', '=', projectId)
      .where('state', '=', stateKey)
      .select(['id', 'title'])
      .execute();
  }

  async updateSortedOrder(projectId: string, orderedIds: string[]) {
    await db.transaction().execute(async (trx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await trx
          .updateTable('work_item_states')
          .set({ sort_order: i, updated_at: new Date() })
          .where('project_id', '=', projectId)
          .where('id', '=', orderedIds[i])
          .execute();
      }
    });
  }

  private mapToCamelCase(row: any) {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      key: row.key,
      color: row.color,
      sortOrder: row.sort_order,
      isDone: row.is_done,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}