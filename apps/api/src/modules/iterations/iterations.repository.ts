import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { CreateIterationDto, UpdateIterationDto } from './dto/iterations.dto.js';

@Injectable()
export class IterationsRepository {
  async create(projectId: string, data: CreateIterationDto) {
    const result = await db
      .insertInto('iterations')
      .values({
        project_id: projectId,
        name: data.name,
        goal: data.goal,
        start_date: data.startDate,
        end_date: data.endDate,
        state: 'PLANNED',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToCamelCase(result);
  }

  async findAllByProject(projectId: string) {
    const results = await db
      .selectFrom('iterations')
      .selectAll()
      .where('project_id', '=', projectId)
      .orderBy('start_date', 'asc')
      .execute();

    const doneKeys = new Set(
      (
        await db
          .selectFrom('work_item_states')
          .where('project_id', '=', projectId)
          .where('is_done', '=', true)
          .select('key')
          .execute()
      ).map((r) => r.key),
    );

    // Fetch work items count for each iteration
    const sprintsWithCounts = await Promise.all(
      results.map(async (iteration) => {
        const items = await db
          .selectFrom('work_items')
          .select(['id', 'state'])
          .where('iteration_id', '=', iteration.id)
          .execute();

        const doneCount = items.filter((i) => doneKeys.has(i.state)).length;
        return {
          ...this.mapToCamelCase(iteration),
          workItemsCount: items.length,
          doneWorkItemsCount: doneCount,
        };
      }),
    );

    return sprintsWithCounts;
  }

  async findOne(id: string) {
    const result = await db
      .selectFrom('iterations')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!result) return null;
    return this.mapToCamelCase(result);
  }

  async update(id: string, data: UpdateIterationDto) {
    let query = db.updateTable('iterations').where('id', '=', id);

    const updateData: any = { updated_at: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.goal !== undefined) updateData.goal = data.goal;
    if (data.startDate !== undefined) updateData.start_date = data.startDate;
    if (data.endDate !== undefined) updateData.end_date = data.endDate;
    if (data.state !== undefined) updateData.state = data.state;

    const result = await query
      .set(updateData)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToCamelCase(result);
  }

  async remove(id: string) {
    await db.deleteFrom('iterations').where('id', '=', id).execute();
  }

  async addHistory(
    iterationId: string,
    userId: string,
    action: string,
    field?: string | null,
    oldValue?: string | null,
    newValue?: string | null,
  ) {
    const iteration = await db
      .selectFrom('iterations')
      .where('id', '=', iterationId)
      .select('id')
      .executeTakeFirst();

    await db
      .insertInto('iteration_history')
      .values({
        iteration_id: iteration ? iterationId : null,
        user_id: userId,
        action,
        field: field ?? null,
        old_value: oldValue ?? null,
        new_value: newValue ?? null,
      })
      .execute();
  }

  async findActiveSprintByProject(projectId: string) {
    const result = await db
      .selectFrom('iterations')
      .selectAll()
      .where('project_id', '=', projectId)
      .where('state', '=', 'ACTIVE')
      .executeTakeFirst();

    if (!result) return null;
    return this.mapToCamelCase(result);
  }

  async addWorkItems(iterationId: string, workItemIds: string[], userId: string) {
    if (workItemIds.length === 0) return;

    await db.transaction().execute(async (trx) => {
      const items = await trx
        .selectFrom('work_items')
        .where('id', 'in', workItemIds)
        .select(['id', 'iteration_id'])
        .execute();

      await trx
        .updateTable('work_items')
        .where('id', 'in', workItemIds)
        .set({ iteration_id: iterationId, updated_at: new Date() })
        .execute();

      await trx
        .insertInto('work_item_history')
        .values(
          items.map((item) => ({
            work_item_id: item.id,
            user_id: userId,
            action: 'ITERATION_CHANGED',
            field: 'iteration_id',
            old_value: item.iteration_id ?? null,
            new_value: iterationId,
          })),
        )
        .execute();
    });
  }

  async removeWorkItem(workItemId: string, userId: string) {
    await db.transaction().execute(async (trx) => {
      const item = await trx
        .selectFrom('work_items')
        .where('id', '=', workItemId)
        .select(['id', 'iteration_id'])
        .executeTakeFirst();

      await trx
        .updateTable('work_items')
        .where('id', '=', workItemId)
        .set({ iteration_id: null, updated_at: new Date() })
        .execute();

      if (item) {
        await trx
          .insertInto('work_item_history')
          .values({
            work_item_id: item.id,
            user_id: userId,
            action: 'ITERATION_CHANGED',
            field: 'iteration_id',
            old_value: item.iteration_id ?? null,
            new_value: null,
          })
          .execute();
      }
    });
  }

  async getSprintWorkItems(iterationId: string) {
    const results = await db
      .selectFrom('work_items')
      .selectAll()
      .where('iteration_id', '=', iterationId)
      .orderBy('seq_no', 'asc')
      .execute();

    return results.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      iterationId: r.iteration_id,
      seqNo: r.seq_no,
      parentId: r.parent_id,
      type: r.type,
      title: r.title,
      description: r.description,
      state: r.state,
      priority: r.priority,
      assignedTo: r.assigned_to,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      completedAt: r.completed_at,
    }));
  }

  private mapToCamelCase(row: any) {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      goal: row.goal,
      startDate: row.start_date,
      endDate: row.end_date,
      state: row.state,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
