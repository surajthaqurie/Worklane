import { Injectable, BadRequestException } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { sql } from 'kysely';
import {
  WorkItemHistoryAction,
  WorkItemHistoryField,
} from '../work-item-history/work-item-history.constants.js';
import { WorkItemHistoryService } from '../work-item-history/work-item-history.service.js';
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
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Full iteration base path, e.g. "Release 1\\Sprint 2" (Azure Boards style). */
  path?: string;
  /** Position of the iteration in the project ordering (1-based). */
  order?: number;
  /** Whether the iteration has child iterations beneath it. */
  hasChildren?: boolean;
  workItemsCount?: number;
  doneWorkItemsCount?: number;
  incompleteCount?: number;
}

export interface WorkItemStatesRow {
  id: string;
  projectId: string;
  key: string;
  name: string;
  color: string;
  sortOrder: number;
  isDone: boolean;
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
  closedAt: Date | null;
}

@Injectable()
export class IterationsRepository {
  constructor(private readonly history: WorkItemHistoryService) {}

  /** Azure Boards limits iteration paths to 14 levels deep. */
  private readonly MAX_ITERATION_DEPTH = 14;

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

  /**
   * Validates that a proposed parent iteration produces a valid hierarchy:
   *  - belongs to the same project
   *  - is not the iteration itself (when updating)
   *  - does not create a cycle (parent must not be a descendant being edited)
   *  - keeps the path within the maximum depth (Azure Boards allows 14 levels)
   */
  async validateParent(
    projectId: string,
    parentId: string,
    excludeId?: string,
  ) {
    const parent = await db
      .selectFrom('iterations')
      .selectAll()
      .where('id', '=', parentId)
      .executeTakeFirst();

    if (!parent || parent.project_id !== projectId) {
      throw new BadRequestException(
        'Parent iteration must belong to the same project',
      );
    }

    if (excludeId && parentId === excludeId) {
      throw new BadRequestException('An iteration cannot be its own parent');
    }

    // Walk up the ancestor chain to detect cycles and measure depth.
    let depth = 1;
    let current = parent;
    const visited = new Set<string>([parent.id]);
    while (current.parent_id) {
      if (excludeId && current.parent_id === excludeId) {
        throw new BadRequestException(
          'Cannot set an iteration as a parent of its own descendant',
        );
      }
      if (visited.has(current.parent_id)) {
        throw new BadRequestException(
          'Iteration hierarchy cannot contain cycles',
        );
      }
      visited.add(current.parent_id);

      const next = await db
        .selectFrom('iterations')
        .selectAll()
        .where('id', '=', current.parent_id)
        .executeTakeFirst();
      if (!next) break;
      current = next;
      depth += 1;
    }

    if (depth >= this.MAX_ITERATION_DEPTH) {
      throw new BadRequestException(
        `Iteration paths can be at most ${this.MAX_ITERATION_DEPTH} levels deep`,
      );
    }
  }

  async countChildren(id: string): Promise<number> {
    const row = await db
      .selectFrom('iterations')
      .where('parent_id', '=', id)
      .select(sql<number>`count(*)::int`.as('count'))
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  /**
   * Computes the Azure Boards style base path (e.g. "Release 1\\Sprint 2"),
   * the 1-based ordering within the project (by start date), and whether the
   * iteration has children. Derived at read time so the hierarchy always stays
   * consistent without maintaining a denormalised column.
   */
  async getPathInfo(
    projectId: string,
  ): Promise<Map<string, { path: string; order: number; hasChildren: boolean }>> {
    const tree = await sql<{ id: string; path: string }>`
      WITH RECURSIVE iteration_tree AS (
        SELECT id, name, parent_id, name::text AS path
        FROM iterations
        WHERE project_id = ${projectId} AND parent_id IS NULL
        UNION ALL
        SELECT i.id, i.name, i.parent_id, (t.path || E'\\\\' || i.name)
        FROM iterations i
        INNER JOIN iteration_tree t ON i.parent_id = t.id
        WHERE i.project_id = ${projectId}
      )
      SELECT id, path
      FROM iteration_tree
    `.execute(db);

    const ordered = await db
      .selectFrom('iterations')
      .where('project_id', '=', projectId)
      .select(['id', 'name'])
      .orderBy('start_date', 'asc')
      .orderBy('created_at', 'asc')
      .orderBy('name', 'asc')
      .execute();

    const children = await db
      .selectFrom('iterations')
      .where('project_id', '=', projectId)
      .where('parent_id', 'is not', null)
      .select(['parent_id'])
      .execute();

    const childCount = new Map<string, number>();
    for (const c of children) {
      childCount.set(c.parent_id!, (childCount.get(c.parent_id!) ?? 0) + 1);
    }

    const orderById = new Map<string, number>();
    ordered.forEach((r, i) => orderById.set(r.id, i + 1));

    const info = new Map<string, { path: string; order: number; hasChildren: boolean }>();
    for (const row of tree.rows) {
      info.set(row.id, {
        path: row.path,
        order: orderById.get(row.id) ?? 0,
        hasChildren: (childCount.get(row.id) ?? 0) > 0,
      });
    }

    // Defensive fallback for any row not reachable through the tree.
    for (const r of ordered) {
      if (!info.has(r.id)) {
        info.set(r.id, {
          path: r.name,
          order: orderById.get(r.id) ?? 0,
          hasChildren: (childCount.get(r.id) ?? 0) > 0,
        });
      }
    }

    return info;
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

    const pathInfo = await this.getPathInfo(projectId);

    return rows.rows.map((r: any) => {
      const base = this.mapToCamelCase(r);
      const extra = pathInfo.get(r.id);
      return {
        ...base,
        ...(extra ?? { path: base.name, order: 0, hasChildren: false }),
        workItemsCount: Number(r.work_items_count),
        doneWorkItemsCount: Number(r.done_work_items_count),
        incompleteCount: Number(r.incomplete_count),
      };
    });
  }

  async findOne(id: string): Promise<IterationRow | null> {
    const result = await db
      .selectFrom('iterations')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!result) return null;
    const base = this.mapToCamelCase(result);
    const pathInfo = await this.getPathInfo(result.project_id);
    const extra = pathInfo.get(id);
    return {
      ...base,
      ...(extra ?? { path: base.name, order: 0, hasChildren: false }),
    };
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
        .set({ iteration_id: iterationId, updated_at: new Date(), version: sql`version + 1` })
        .execute();

      if (items.length > 0) {
        await this.history.recordMany(
          trx,
          items.map((item) => ({
            workItemId: item.id,
            actorId: userId,
            action: WorkItemHistoryAction.ITERATION_CHANGED,
            field: WorkItemHistoryField.ITERATION,
            previousValue: item.iteration_id ?? null,
            newValue: iterationId,
          })),
        );
      }
    });
  }

  async removeWorkItem(iterationId: string, workItemId: string, userId: string) {
    await db.transaction().execute(async (trx) => {
      const item = await trx
        .selectFrom('work_items')
        .where('id', '=', workItemId)
        .select(['id', 'iteration_id'])
        .executeTakeFirst();

      if (!item || item.iteration_id !== iterationId) {
        throw new BadRequestException(
          'Work item is not assigned to this iteration',
        );
      }

      await trx
        .updateTable('work_items')
        .where('id', '=', workItemId)
        .set({ iteration_id: null, updated_at: new Date(), version: sql`version + 1` })
        .execute();

      await this.history.record(trx, {
        workItemId: item.id,
        actorId: userId,
        action: WorkItemHistoryAction.ITERATION_CHANGED,
        field: WorkItemHistoryField.ITERATION,
        previousValue: iterationId,
        newValue: null,
      });
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
        .set({ iteration_id: targetIterationId, updated_at: new Date(), version: sql`version + 1` })
        .execute();

      if (items.length > 0) {
        await this.history.recordMany(
          trx,
          items.map((item) => ({
            workItemId: item.id,
            actorId: userId,
            action: WorkItemHistoryAction.ITERATION_CHANGED,
            field: WorkItemHistoryField.ITERATION,
            previousValue: item.iteration_id ?? null,
            newValue: targetIterationId ?? null,
          })),
        );
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
  async getSprintWorkItems(
    iterationId: string,
    projectKey: string,
    areaIds?: string[],
  ): Promise<SprintWorkItem[]> {
    const areaClause =
      areaIds && areaIds.length > 0 ? sql`AND wi.area_id IN (${sql.join(areaIds)})` : sql``;
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
        wi.completed_at,
        wi.closed_at
      FROM work_items wi
      LEFT JOIN users u ON u.id = wi.assigned_to
      LEFT JOIN areas a ON a.id = wi.area_id
      WHERE wi.iteration_id = ${iterationId}
      ${areaClause}
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
      closedAt: r.closed_at,
    }));
  }

  /**
   * Returns the project's workflow states, ordered by sort_order,
   * for grouping sprint board columns.
   */
  async getWorkflowStates(projectId: string): Promise<WorkItemStatesRow[]> {
    const rows = await db
      .selectFrom('work_item_states')
      .select(['id', 'project_id', 'key', 'name', 'color', 'sort_order', 'is_done'])
      .where('project_id', '=', projectId)
      .orderBy('sort_order', 'asc')
      .execute();

    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      key: r.key,
      name: r.name,
      color: r.color,
      sortOrder: r.sort_order,
      isDone: r.is_done,
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
      status: row.state,
      parentId: row.parent_id ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
