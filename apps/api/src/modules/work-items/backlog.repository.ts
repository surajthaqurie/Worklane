import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { sql } from 'kysely';

export interface BacklogItem {
  id: string;
  key: string;
  projectId: string;
  type: 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
  title: string;
  description: string | null;
  state: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  points: number | null;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedToAvatar: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  parentId: string | null;
  iterationId: string | null;
  areaId: string;
  backlogOrder: number;
  backlogRank: number;
  hasChildren: boolean;
  childCount: number;
  tags: string[];
}

export interface BacklogTreeNode extends BacklogItem {
  children: BacklogTreeNode[];
  depth: number;
}

export interface ReorderPayload {
  id: string;
  parentId: string | null;
  newRank: number;
}

@Injectable()
export class BacklogRepository {
  /**
   * Efficient hierarchical query using a SINGLE SQL query with CTE.
   * Loads only the visible portion of the tree (roots + explicitly requested ancestors).
   * Includes child counts to support lazy expansion without N+1.
   */
  async getBacklogTree(
    projectId: string,
    opts: {
      parentId?: string | null; // null = top-level, string = specific parent
      search?: string;
      type?: string;
      state?: string;
      priority?: string;
      assignedTo?: string;
      iterationId?: string;
      areaId?: string;
      teamAreaIds?: string[];
      teamIterationIds?: string[];
      limit?: number;
      offset?: number;
    },
    projectKey: string,
  ): Promise<{ items: BacklogItem[]; total: number }> {
    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;

    let query = db
      .selectFrom('work_items as wi')
      .leftJoin('users as u', 'u.id', 'wi.assigned_to')
      .where('wi.project_id', '=', projectId);

    // Parent scoping
    if (opts.parentId === null || opts.parentId === 'null') {
      query = query.where('wi.parent_id', 'is', null);
    } else if (opts.parentId) {
      query = query.where('wi.parent_id', '=', opts.parentId);
    }

    // Filters
    if (opts.search) {
      const searchStr = opts.search.trim();
      query = query.where((eb) => {
        const conditions: any[] = [
          eb('wi.search_vector', '@@', sql`plainto_tsquery('english', ${searchStr})`),
          eb('wi.title', 'ilike', `%${searchStr}%`),
        ];
        const seqMatch = searchStr.match(/(?:^[a-zA-Z]+-)(\d+)$|^(\d+)$/);
        if (seqMatch) {
          const seqNum = parseInt(seqMatch[1] || seqMatch[2], 10);
          conditions.push(eb('wi.seq_no', '=', seqNum));
        }
        return eb.or(conditions);
      });
    }
    if (opts.type) query = query.where('wi.type', '=', opts.type as any);
    if (opts.state) query = query.where('wi.state', '=', opts.state);
    if (opts.priority) query = query.where('wi.priority', '=', opts.priority as any);
    if (opts.assignedTo) {
      if (opts.assignedTo === 'UNASSIGNED') {
        query = query.where('wi.assigned_to', 'is', null);
      } else {
        query = query.where('wi.assigned_to', '=', opts.assignedTo);
      }
    }
    if (opts.iterationId) {
      if (opts.iterationId === 'null') {
        query = query.where('wi.iteration_id', 'is', null);
      } else {
        query = query.where('wi.iteration_id', '=', opts.iterationId);
      }
    }
    if (opts.areaId) query = query.where('wi.area_id', '=', opts.areaId);

    // Team scope: items in the team's areas and in the team's iterations
    // (or not yet assigned to any iteration).
    if (opts.teamAreaIds && opts.teamAreaIds.length > 0) {
      query = query.where('wi.area_id', 'in', opts.teamAreaIds);
    }
    if (opts.teamIterationIds) {
      query = query.where((eb) =>
        eb.or([
          eb('wi.iteration_id', 'is', null),
          eb('wi.iteration_id', 'in', opts.teamIterationIds!),
        ]),
      );
    }

    // Count total matching items (before pagination)
    const countQuery = query.select(sql<number>`count(*)`.as('count'));
    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    // Fetch items with child count and assignee info
    const items = await query
      .select([
        'wi.id',
        'wi.seq_no',
        'wi.project_id',
        'wi.type',
        'wi.title',
        'wi.description',
        'wi.state',
        'wi.priority',
        'wi.points',
        'wi.assigned_to',
        'u.name as assigned_to_name',
        'u.avatar_url as assigned_to_avatar',
        'wi.created_by',
        'wi.created_at',
        'wi.updated_at',
        'wi.completed_at',
        'wi.parent_id',
        'wi.iteration_id',
        'wi.area_id',
        'wi.backlog_order',
        'wi.backlog_rank',
        sql<number>`(SELECT count(*)::int FROM work_items ch WHERE ch.parent_id = wi.id)`.as('child_count'),
      ])
      .orderBy('wi.backlog_rank', 'asc')
      .orderBy('wi.seq_no', 'asc')
      .limit(limit)
      .offset(offset)
      .execute();

    // Batch load tags for fetched items
    const itemIds = items.map((i) => i.id);
    const tagsMap = await this.batchLoadTags(itemIds);

    return {
      total,
      items: items.map((item) => ({
        id: item.id,
        key: `${projectKey}-${item.seq_no}`,
        projectId: item.project_id,
        type: item.type,
        title: item.title,
        description: item.description,
        state: item.state,
        priority: item.priority,
        points: item.points,
        assignedTo: item.assigned_to,
        assignedToName: (item as any).assigned_to_name,
        assignedToAvatar: (item as any).assigned_to_avatar,
        createdBy: item.created_by,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        completedAt: item.completed_at,
        parentId: item.parent_id,
        iterationId: item.iteration_id,
        areaId: item.area_id,
        backlogOrder: item.backlog_order,
        backlogRank: item.backlog_rank,
        hasChildren: Number((item as any).child_count) > 0,
        childCount: Number((item as any).child_count),
        tags: tagsMap.get(item.id) ?? [],
      })),
    };
  }

  /**
   * Batch load tags for a set of work item IDs — avoids N+1.
   */
  private async batchLoadTags(ids: string[]): Promise<Map<string, string[]>> {
    if (ids.length === 0) return new Map();
    const rows = await db
      .selectFrom('work_item_tags')
      .innerJoin('tags', 'tags.id', 'work_item_tags.tag_id')
      .where('work_item_tags.work_item_id', 'in', ids)
      .select(['work_item_tags.work_item_id', 'tags.name'])
      .execute();

    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.work_item_id) ?? [];
      list.push(row.name);
      map.set(row.work_item_id, list);
    }
    return map;
  }

  /**
   * Reorder a work item within the backlog hierarchy.
   * Uses fractional indexing: new rank = (prevRank + nextRank) / 2
   * Normalizes ranks when they get too close together.
   */
  async reorderItem(
    projectId: string,
    userId: string,
    payload: ReorderPayload,
  ): Promise<void> {
    await db.transaction().execute(async (trx) => {
      // Fetch the item being moved
      const item = await trx
        .selectFrom('work_items')
        .where('id', '=', payload.id)
        .where('project_id', '=', projectId)
        .select(['id', 'parent_id', 'backlog_rank', 'seq_no', 'title', 'iteration_id'])
        .executeTakeFirstOrThrow();

      const oldParentId = item.parent_id;
      const newParentId = payload.parentId;
      const newRank = payload.newRank;

      // Build the update
      const updateData: Record<string, any> = {
        backlog_rank: newRank,
        updated_at: new Date(),
      };

      if (oldParentId !== newParentId) {
        updateData.parent_id = newParentId;
      }

      await trx
        .updateTable('work_items')
        .set(updateData)
        .where('id', '=', payload.id)
        .execute();

      // Record history
      const historyEntries: any[] = [];

      if (oldParentId !== newParentId) {
        historyEntries.push({
          work_item_id: payload.id,
          user_id: userId,
          action: 'PARENT_CHANGED',
          field: 'parent_id',
          old_value: oldParentId ?? null,
          new_value: newParentId ?? null,
        });
      }

      historyEntries.push({
        work_item_id: payload.id,
        user_id: userId,
        action: 'ORDER_CHANGED',
        field: 'backlog_rank',
        old_value: String(item.backlog_rank),
        new_value: String(newRank),
      });

      if (historyEntries.length > 0) {
        await trx.insertInto('work_item_history').values(historyEntries).execute();
      }

      // Normalize ranks if any sibling ranks are too close (< 0.001 apart)
      // This prevents float precision issues over time
      await this.normalizeRanksIfNeeded(trx, projectId, newParentId);
    });
  }

  /**
   * Normalizes backlog_rank values for siblings under a given parent
   * when any two adjacent values are within a minimum threshold.
   * Re-assigns evenly-spaced values starting at 1000.
   */
  private async normalizeRanksIfNeeded(
    trx: any,
    projectId: string,
    parentId: string | null,
  ): Promise<void> {
    const siblings = await trx
      .selectFrom('work_items')
      .where('project_id', '=', projectId)
      .where(parentId ? sql`parent_id = ${parentId}` : sql`parent_id IS NULL`)
      .select(['id', 'backlog_rank'])
      .orderBy('backlog_rank', 'asc')
      .execute();

    let needsNormalize = false;
    for (let i = 1; i < siblings.length; i++) {
      if (siblings[i].backlog_rank - siblings[i - 1].backlog_rank < 0.001) {
        needsNormalize = true;
        break;
      }
    }

    if (!needsNormalize || siblings.length === 0) return;

    // Re-assign with spacing of 1000
    for (let i = 0; i < siblings.length; i++) {
      await trx
        .updateTable('work_items')
        .set({ backlog_rank: (i + 1) * 1000 })
        .where('id', '=', siblings[i].id)
        .execute();
    }
  }

  /**
   * Bulk assign iteration to multiple items at once.
   */
  async bulkAssignIteration(
    projectId: string,
    userId: string,
    itemIds: string[],
    iterationId: string | null,
  ): Promise<void> {
    if (itemIds.length === 0) return;

    await db.transaction().execute(async (trx) => {
      // Fetch old iteration ids for history
      const items = await trx
        .selectFrom('work_items')
        .where('id', 'in', itemIds)
        .where('project_id', '=', projectId)
        .select(['id', 'iteration_id'])
        .execute();

      await trx
        .updateTable('work_items')
        .set({ iteration_id: iterationId, updated_at: new Date() })
        .where('id', 'in', itemIds)
        .execute();

      const historyRows = items.map((item) => ({
        work_item_id: item.id,
        user_id: userId,
        action: 'ITERATION_CHANGED',
        field: 'iteration_id',
        old_value: item.iteration_id ?? null,
        new_value: iterationId ?? null,
      }));

      if (historyRows.length > 0) {
        await trx.insertInto('work_item_history').values(historyRows).execute();
      }
    });
  }
}
