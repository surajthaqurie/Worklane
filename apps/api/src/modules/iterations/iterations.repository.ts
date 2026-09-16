import { Injectable, BadRequestException } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { sql } from 'kysely';
import {
  CreateIterationDto,
  UpdateIterationDto,
} from './dto/iterations.dto.js';

export interface IterationRow {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: Date;
  endDate: Date;
  state: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  workItemsCount?: number;
  doneWorkItemsCount?: number;
  incompleteCount?: number;
}

export interface SprintWorkItem {
  id: string;
  key: string;
  projectId: string;
  iterationId: string | null;
  seqNo: number;
  parentId: string | null;
  type: string;
  title: string;
  description: string | null;
  state: string;
  priority: string;
  points: number | null;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedToAvatar: string | null;
  areaId: string;
  areaName: string | null;
  backlogRank: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

@Injectable()
export class IterationsRepository {
  // ─── Validation helpers ────────────────────────────────────────────────────

  validateDates(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    if (end <= start) {
      throw new BadRequestException('End date must be after start date');
    }
  }

  async checkDateOverlap(
    projectId: string,
    startDate: string,
    endDate: string,
    parentId: string | null | undefined,
    excludeId?: string,
  ) {
    // Overlap condition: newStart < existingEnd AND newEnd > existingStart
    let query = db
      .selectFrom('iterations')
      .where('project_id', '=', projectId)
      .where('start_date', '<', new Date(endDate))
      .where('end_date', '>', new Date(startDate));

    if (parentId !== undefined) {
      if (parentId === null) {
        query = query.where('parent_id', 'is', null);
      } else {
        query = query.where('parent_id', '=', parentId);
      }
    }

    if (excludeId) {
      query = query.where('id', '!=', excludeId);
    }

    const conflicts = await query.select(['id', 'name', 'start_date', 'end_date']).execute();

    if (conflicts.length > 0) {
      const names = conflicts.map((c) => c.name).join(', ');
      throw new BadRequestException(
        `Iteration dates overlap with existing iteration(s): ${names}`,
      );
    }
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(projectId: string, data: CreateIterationDto): Promise<IterationRow> {
    const result = await db
      .insertInto('iterations')
      .values({
        project_id: projectId,
        name: data.name,
        goal: data.goal ?? null,
        start_date: data.startDate,
        end_date: data.endDate,
        state: 'PLANNED',
        parent_id: data.parentId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToCamelCase(result);
  }

  /**
   * Efficient single-query load with work item counts.
   * Uses LEFT JOINs to avoid N+1.
   */
  async findAllByProject(projectId: string): Promise<IterationRow[]> {
    const rows = await sql<any>`
      SELECT
        i.id,
        i.project_id,
        i.name,
        i.goal,
        i.start_date,
        i.end_date,
        i.state,
        i.parent_id,
        i.created_at,
        i.updated_at,
        COUNT(wi.id)::int                                                       AS work_items_count,
        COUNT(CASE WHEN wis.is_done = true  THEN 1 END)::int                   AS done_work_items_count,
        COUNT(CASE WHEN (wis.is_done = false OR wis.is_done IS NULL) AND wi.id IS NOT NULL THEN 1 END)::int AS incomplete_count
      FROM iterations i
      LEFT JOIN work_items wi
        ON wi.iteration_id = i.id
      LEFT JOIN work_item_states wis
        ON wis.key = wi.state AND wis.project_id = i.project_id
      WHERE i.project_id = ${projectId}
      GROUP BY i.id
      ORDER BY i.start_date ASC
    `.execute(db);

    return rows.rows.map((r: any) => ({
      ...this.mapToCamelCase(r),
      workItemsCount: Number(r.work_items_count),
      doneWorkItemsCount: Number(r.done_work_items_count),
      incompleteCount: Number(r.incomplete_count),
    }));
  }

  async findOne(id: string): Promise<IterationRow | null> {
    const result = await db
      .selectFrom('iterations')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!result) return null;
    return this.mapToCamelCase(result);
  }

  async findActiveByProject(projectId: string): Promise<IterationRow | null> {
    const result = await db
      .selectFrom('iterations')
      .selectAll()
      .where('project_id', '=', projectId)
      .where('state', '=', 'ACTIVE')
      .executeTakeFirst();

    if (!result) return null;
    return this.mapToCamelCase(result);
  }

  async update(id: string, data: UpdateIterationDto): Promise<IterationRow> {
    const updateData: Record<string, any> = { updated_at: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.goal !== undefined) updateData.goal = data.goal ?? null;
    if (data.startDate !== undefined) updateData.start_date = data.startDate;
    if (data.endDate !== undefined) updateData.end_date = data.endDate;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.parentId !== undefined) updateData.parent_id = data.parentId ?? null;

    const result = await db
      .updateTable('iterations')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToCamelCase(result);
  }

  async remove(id: string) {
    await db.deleteFrom('iterations').where('id', '=', id).execute();
  }

  // ─── Work item management ─────────────────────────────────────────────────

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

      if (items.length > 0) {
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
      }
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

  /**
   * Bulk move work items to a different iteration or to the backlog (targetIterationId=null).
   * Records work_item_history for each item.
   */
  async moveItemsToIteration(
    workItemIds: string[],
    targetIterationId: string | null,
    userId: string,
  ) {
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
        .set({ iteration_id: targetIterationId, updated_at: new Date() })
        .execute();

      if (items.length > 0) {
        await trx
          .insertInto('work_item_history')
          .values(
            items.map((item) => ({
              work_item_id: item.id,
              user_id: userId,
              action: 'ITERATION_CHANGED',
              field: 'iteration_id',
              old_value: item.iteration_id ?? null,
              new_value: targetIterationId ?? null,
            })),
          )
          .execute();
      }
    });
  }

  /**
   * Completes an iteration.
   * Returns the incomplete (not-done) work items so the caller can handle them explicitly.
   * NEVER silently loses work items.
   */
  async completeIteration(
    iterationId: string,
    userId: string,
  ): Promise<{ incompleteItems: { id: string; title: string; state: string }[] }> {
    return await db.transaction().execute(async (trx) => {
      // Get all items in this sprint with their done status in one query
      const itemsWithStatus = await sql<{
        id: string;
        title: string;
        state: string;
        is_done: boolean;
      }>`
        SELECT wi.id, wi.title, wi.state, COALESCE(wis.is_done, false) AS is_done
        FROM work_items wi
        LEFT JOIN work_item_states wis
          ON wis.key = wi.state
          AND wis.project_id = wi.project_id
        WHERE wi.iteration_id = ${iterationId}
      `.execute(trx);

      const incompleteItems = itemsWithStatus.rows
        .filter((r) => !r.is_done)
        .map((r) => ({ id: r.id, title: r.title, state: r.state }));

      // Mark the iteration as COMPLETED
      await trx
        .updateTable('iterations')
        .set({ state: 'COMPLETED', updated_at: new Date() })
        .where('id', '=', iterationId)
        .execute();

      // Record in iteration_history
      await trx
        .insertInto('iteration_history')
        .values({
          iteration_id: iterationId,
          user_id: userId,
          action: 'COMPLETED',
          field: 'state',
          old_value: 'ACTIVE',
          new_value: 'COMPLETED',
        })
        .execute();

      return { incompleteItems };
    });
  }

  // ─── Sprint backlog ────────────────────────────────────────────────────────

  /**
   * Returns all work items for a sprint with enriched data (assignee, area).
   * Single query with LEFT JOINs — no N+1.
   */
  async getSprintWorkItems(iterationId: string, projectKey: string): Promise<SprintWorkItem[]> {
    const rows = await sql<any>`
      SELECT
        wi.id,
        wi.project_id,
        wi.iteration_id,
        wi.seq_no,
        wi.parent_id,
        wi.type,
        wi.title,
        wi.description,
        wi.state,
        wi.priority,
        wi.points,
        wi.assigned_to,
        u.name    AS assigned_to_name,
        u.avatar_url AS assigned_to_avatar,
        wi.area_id,
        a.name    AS area_name,
        wi.backlog_rank,
        wi.created_by,
        wi.created_at,
        wi.updated_at,
        wi.completed_at
      FROM work_items wi
      LEFT JOIN users u ON u.id = wi.assigned_to
      LEFT JOIN areas a ON a.id = wi.area_id
      WHERE wi.iteration_id = ${iterationId}
      ORDER BY wi.backlog_rank ASC, wi.seq_no ASC
    `.execute(db);

    return rows.rows.map((r: any) => ({
      id: r.id,
      key: `${projectKey}-${r.seq_no}`,
      projectId: r.project_id,
      iterationId: r.iteration_id,
      seqNo: r.seq_no,
      parentId: r.parent_id,
      type: r.type,
      title: r.title,
      description: r.description,
      state: r.state,
      priority: r.priority,
      points: r.points,
      assignedTo: r.assigned_to,
      assignedToName: r.assigned_to_name,
      assignedToAvatar: r.assigned_to_avatar,
      areaId: r.area_id,
      areaName: r.area_name,
      backlogRank: r.backlog_rank,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      completedAt: r.completed_at,
    }));
  }

  // ─── History ──────────────────────────────────────────────────────────────

  async addHistory(
    iterationId: string,
    userId: string,
    action: string,
    field?: string | null,
    oldValue?: string | null,
    newValue?: string | null,
  ) {
    await db
      .insertInto('iteration_history')
      .values({
        iteration_id: iterationId,
        user_id: userId,
        action,
        field: field ?? null,
        old_value: oldValue ?? null,
        new_value: newValue ?? null,
      })
      .execute();
  }

  // ─── Mapping ─────────────────────────────────────────────────────────────

  private mapToCamelCase(row: any): IterationRow {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      goal: row.goal,
      startDate: row.start_date,
      endDate: row.end_date,
      state: row.state,
      parentId: row.parent_id ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
