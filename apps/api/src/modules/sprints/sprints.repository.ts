import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { CreateSprintDto, UpdateSprintDto } from './dto/sprints.dto.js';

@Injectable()
export class SprintsRepository {
  async create(projectId: string, data: CreateSprintDto) {
    const result = await db
      .insertInto('sprints')
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
      .selectFrom('sprints')
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

    // Fetch work items count for each sprint
    const sprintsWithCounts = await Promise.all(
      results.map(async (sprint) => {
        const items = await db
          .selectFrom('work_items')
          .select(['id', 'state'])
          .where('sprint_id', '=', sprint.id)
          .execute();

        const doneCount = items.filter((i) => doneKeys.has(i.state)).length;
        return {
          ...this.mapToCamelCase(sprint),
          workItemsCount: items.length,
          doneWorkItemsCount: doneCount,
        };
      }),
    );

    return sprintsWithCounts;
  }

  async findOne(id: string) {
    const result = await db
      .selectFrom('sprints')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!result) return null;
    return this.mapToCamelCase(result);
  }

  async update(id: string, data: UpdateSprintDto) {
    let query = db.updateTable('sprints').where('id', '=', id);

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
    await db.deleteFrom('sprints').where('id', '=', id).execute();
  }

  async addHistory(
    sprintId: string,
    userId: string,
    action: string,
    field?: string | null,
    oldValue?: string | null,
    newValue?: string | null,
  ) {
    const sprint = await db
      .selectFrom('sprints')
      .where('id', '=', sprintId)
      .select('id')
      .executeTakeFirst();

    await db
      .insertInto('sprint_history')
      .values({
        sprint_id: sprint ? sprintId : null,
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
      .selectFrom('sprints')
      .selectAll()
      .where('project_id', '=', projectId)
      .where('state', '=', 'ACTIVE')
      .executeTakeFirst();

    if (!result) return null;
    return this.mapToCamelCase(result);
  }

  async addWorkItems(sprintId: string, workItemIds: string[], userId: string) {
    if (workItemIds.length === 0) return;

    await db.transaction().execute(async (trx) => {
      const items = await trx
        .selectFrom('work_items')
        .where('id', 'in', workItemIds)
        .select(['id', 'sprint_id'])
        .execute();

      await trx
        .updateTable('work_items')
        .where('id', 'in', workItemIds)
        .set({ sprint_id: sprintId, updated_at: new Date() })
        .execute();

      await trx
        .insertInto('work_item_history')
        .values(
          items.map((item) => ({
            work_item_id: item.id,
            user_id: userId,
            action: 'SPRINT_CHANGED',
            field: 'sprint_id',
            old_value: item.sprint_id ?? null,
            new_value: sprintId,
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
        .select(['id', 'sprint_id'])
        .executeTakeFirst();

      await trx
        .updateTable('work_items')
        .where('id', '=', workItemId)
        .set({ sprint_id: null, updated_at: new Date() })
        .execute();

      if (item) {
        await trx
          .insertInto('work_item_history')
          .values({
            work_item_id: item.id,
            user_id: userId,
            action: 'SPRINT_CHANGED',
            field: 'sprint_id',
            old_value: item.sprint_id ?? null,
            new_value: null,
          })
          .execute();
      }
    });
  }

  async getSprintWorkItems(sprintId: string) {
    const results = await db
      .selectFrom('work_items')
      .selectAll()
      .where('sprint_id', '=', sprintId)
      .orderBy('seq_no', 'asc')
      .execute();

    return results.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      sprintId: r.sprint_id,
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
