import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { sql, type SqlBool } from 'kysely';
import {
  WorkItemHistoryAction,
  WorkItemHistoryEntryInput,
  WorkItemHistoryField,
} from '../work-item-history/work-item-history.constants.js';
import { WorkItemHistoryService } from '../work-item-history/work-item-history.service.js';
import type {
  WorkItemPriority,
  WorkItemType,
} from './work-item.types.js';

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
  parentId?: string | null;
  previousItemId?: string | null;
  nextItemId?: string | null;
  newRank?: number;
  expectedVersion?: number;
  teamId?: string | null;
  iterationId?: string | null;
  state?: string | null;
}

@Injectable()
export class BacklogRepository {
  constructor(private readonly history: WorkItemHistoryService) {}

  /**
   * Efficient hierarchical query using a SINGLE SQL query with CTE.
   * Loads only the visible portion of the tree (roots + explicitly requested ancestors).
   * Includes child counts to support lazy expansion without N+1.
   */
  async getBacklogTree(
    projectId: string,
    filters: {
      parentId: string | null;
      search?: string;
      type?: string;
      state?: string;
      priority?: string;
      assignedTo?: string;
      iterationId?: string;
      areaId?: string;
      teamAreaIds?: string[];
      teamIterationIds?: string[];
      limit: number;
      offset: number;
    },
    projectKey: string,
  ): Promise<{ items: BacklogTreeNode[]; totalCount: number }> {
    return this.getBacklogTreeInternal(projectId, filters, projectKey);
  }

  private async getBacklogTreeInternal(
    projectId: string,
    filters: {
      parentId: string | null;
      search?: string;
      type?: string;
      state?: string;
      priority?: string;
      assignedTo?: string;
      iterationId?: string;
      areaId?: string;
      teamAreaIds?: string[];
      teamIterationIds?: string[];
      limit: number;
      offset: number;
    },
    projectKey: string,
  ): Promise<{ items: BacklogTreeNode[]; totalCount: number }> {
    let query = db
      .selectFrom('work_items as wi')
      .leftJoin('users as u', 'u.id', 'wi.assigned_to')
      .where('wi.project_id', '=', projectId);

    if (filters.parentId !== undefined) {
      if (filters.parentId === null) {
        query = query.where('wi.parent_id', 'is', null);
      } else {
        query = query.where('wi.parent_id', '=', filters.parentId);
      }
    }

    if (filters.type) {
      query = query.where('wi.type', '=', filters.type as WorkItemType);
    }
    if (filters.state) {
      query = query.where('wi.state', '=', filters.state);
    }
    if (filters.priority) {
      query = query.where('wi.priority', '=', filters.priority as WorkItemPriority);
    }
    if (filters.assignedTo) {
      if (filters.assignedTo === 'UNASSIGNED') {
        query = query.where('wi.assigned_to', 'is', null);
      } else {
        query = query.where('wi.assigned_to', '=', filters.assignedTo);
      }
    }
    if (filters.iterationId) {
      if (filters.iterationId === 'null') {
        query = query.where('wi.iteration_id', 'is', null);
      } else {
        query = query.where('wi.iteration_id', '=', filters.iterationId);
      }
    }
    if (filters.areaId) query = query.where('wi.area_id', '=', filters.areaId);

    // Team scope: items in the team's areas and in the team's iterations
    // (or not yet assigned to any iteration).
    if (filters.teamAreaIds && filters.teamAreaIds.length > 0) {
      query = query.where('wi.area_id', 'in', filters.teamAreaIds);
    }
    if (filters.teamIterationIds) {
      query = query.where((eb) =>
        eb.or([
          eb('wi.iteration_id', 'is', null),
          eb('wi.iteration_id', 'in', filters.teamIterationIds!),
        ]),
      );
    }

    if (filters.search) {
      const searchStr = filters.search.trim();
      query = query.where((eb) => {
        const conditions: any[] = [
          sql<SqlBool>`wi.search_vector @@ plainto_tsquery('english', ${searchStr})`,
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

    const countRes = await query
      .select(sql<number>`count(*)`.as('count'))
      .executeTakeFirst();
    const totalCount = Number(countRes?.count ?? 0);

    const rows = await query
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
      .limit(filters.limit)
      .offset(filters.offset)
      .execute();

    const itemIds = rows.map((i) => i.id);
    const tagsMap = await this.batchLoadTags(itemIds);

    const items: BacklogTreeNode[] = rows.map((r: any) => ({
      id: r.id,
      key: `${projectKey}-${r.seq_no}`,
      projectId: r.project_id,
      type: r.type,
      title: r.title,
      description: r.description,
      state: r.state,
      priority: r.priority,
      points: r.points,
      assignedTo: r.assigned_to,
      assignedToName: r.assigned_to_name,
      assignedToAvatar: r.assigned_to_avatar,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      completedAt: r.completed_at,
      parentId: r.parent_id,
      iterationId: r.iteration_id,
      areaId: r.area_id,
      backlogOrder: r.backlog_order,
      backlogRank: Number(r.backlog_rank),
      hasChildren: Number(r.child_count) > 0,
      childCount: Number(r.child_count),
      tags: tagsMap.get(r.id) ?? [],
      children: [],
      depth: 0,
    }));

    return { items, totalCount };
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
   * Ranks are strictly server-generated and scoped to the target container.
   * Concurrency conflicts return a structured recoverable response payload.
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
        .select(['id', 'parent_id', 'backlog_rank', 'seq_no', 'title', 'iteration_id', 'state', 'version'])
        .executeTakeFirstOrThrow();

      if (payload.expectedVersion !== undefined && item.version !== payload.expectedVersion) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'REORDER_CONCURRENCY_CONFLICT',
          message: `Conflict: Work item "${item.title}" was updated by another user (expected version ${payload.expectedVersion}, current version ${item.version}).`,
          details: {
            itemId: payload.id,
            expectedVersion: payload.expectedVersion,
            currentVersion: item.version,
            reloadRequired: true,
          },
        });
      }

      const oldParentId = item.parent_id;
      const newParentId = payload.parentId;
      let calculatedRank: number | null = null;

      // Server-generated ordering: calculate rank strictly relative to adjacent items in target container
      if (payload.previousItemId || payload.nextItemId) {
        let prevRank: number | null = null;
        let nextRank: number | null = null;

        if (payload.previousItemId) {
          let prevQuery = trx
            .selectFrom('work_items')
            .where('id', '=', payload.previousItemId)
            .where('project_id', '=', projectId);

          if (newParentId !== undefined) {
            if (newParentId) {
              prevQuery = prevQuery.where('parent_id', '=', newParentId);
            } else {
              prevQuery = prevQuery.where('parent_id', 'is', null);
            }
          }

          if (payload.iterationId !== undefined) {
            if (payload.iterationId) {
              prevQuery = prevQuery.where('iteration_id', '=', payload.iterationId);
            } else {
              prevQuery = prevQuery.where('iteration_id', 'is', null);
            }
          }

          if (payload.state !== undefined && payload.state !== null) {
            prevQuery = prevQuery.where('state', '=', payload.state);
          }

          const prevItem = await prevQuery.select('backlog_rank').executeTakeFirst();
          if (!prevItem) {
            throw new BadRequestException(
              `Previous item ${payload.previousItemId} does not belong to the target scope`,
            );
          }
          prevRank = Number(prevItem.backlog_rank);
        }

        if (payload.nextItemId) {
          let nextQuery = trx
            .selectFrom('work_items')
            .where('id', '=', payload.nextItemId)
            .where('project_id', '=', projectId);

          if (newParentId !== undefined) {
            if (newParentId) {
              nextQuery = nextQuery.where('parent_id', '=', newParentId);
            } else {
              nextQuery = nextQuery.where('parent_id', 'is', null);
            }
          }

          if (payload.iterationId !== undefined) {
            if (payload.iterationId) {
              nextQuery = nextQuery.where('iteration_id', '=', payload.iterationId);
            } else {
              nextQuery = nextQuery.where('iteration_id', 'is', null);
            }
          }

          if (payload.state !== undefined && payload.state !== null) {
            nextQuery = nextQuery.where('state', '=', payload.state);
          }

          const nextItem = await nextQuery.select('backlog_rank').executeTakeFirst();
          if (!nextItem) {
            throw new BadRequestException(
              `Next item ${payload.nextItemId} does not belong to the target scope`,
            );
          }
          nextRank = Number(nextItem.backlog_rank);
        }

        if (prevRank !== null && nextRank !== null) {
          calculatedRank = (prevRank + nextRank) / 2;
        } else if (prevRank !== null) {
          calculatedRank = prevRank + 1000;
        } else if (nextRank !== null) {
          calculatedRank = nextRank / 2;
        }
      }

      // If no valid neighbors were specified, compute target rank from container bounds
      if (calculatedRank === null) {
        let siblingsQuery = trx
          .selectFrom('work_items')
          .where('project_id', '=', projectId);

        if (newParentId !== undefined) {
          if (newParentId) {
            siblingsQuery = siblingsQuery.where('parent_id', '=', newParentId);
          } else {
            siblingsQuery = siblingsQuery.where('parent_id', 'is', null);
          }
        }

        if (payload.iterationId !== undefined) {
          if (payload.iterationId) {
            siblingsQuery = siblingsQuery.where('iteration_id', '=', payload.iterationId);
          } else {
            siblingsQuery = siblingsQuery.where('iteration_id', 'is', null);
          }
        }

        if (payload.state !== undefined && payload.state !== null) {
          siblingsQuery = siblingsQuery.where('state', '=', payload.state);
        }

        const siblings = await siblingsQuery
          .select('backlog_rank')
          .orderBy('backlog_rank', 'asc')
          .execute();

        if (siblings.length === 0) {
          calculatedRank = 1000;
        } else {
          const maxRank = Number(siblings[siblings.length - 1].backlog_rank);
          calculatedRank = maxRank + 1000;
        }
      }

      // Build the update
      const updateData: Record<string, any> = {
        backlog_rank: calculatedRank,
        updated_at: new Date(),
        version: sql`version + 1`,
      };

      if (newParentId !== undefined && oldParentId !== newParentId) {
        updateData.parent_id = newParentId;
      }
      if (payload.iterationId !== undefined && item.iteration_id !== payload.iterationId) {
        updateData.iteration_id = payload.iterationId;
      }
      if (payload.state !== undefined && payload.state !== null && item.state !== payload.state) {
        updateData.state = payload.state;
      }

      let updateQuery = trx
        .updateTable('work_items')
        .set(updateData)
        .where('id', '=', payload.id);

      if (payload.expectedVersion !== undefined) {
        updateQuery = updateQuery.where('version', '=', payload.expectedVersion);
      }

      const res = await updateQuery.executeTakeFirst();
      if (payload.expectedVersion !== undefined && Number(res.numUpdatedRows) === 0) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'REORDER_CONCURRENCY_CONFLICT',
          message: `Conflict: Work item "${item.title}" was updated by another user.`,
          details: {
            itemId: payload.id,
            expectedVersion: payload.expectedVersion,
            currentVersion: item.version,
            reloadRequired: true,
          },
        });
      }

      // Record history
      const entries: WorkItemHistoryEntryInput[] = [];

      if (oldParentId !== newParentId) {
        entries.push({
          workItemId: payload.id,
          actorId: userId,
          action: WorkItemHistoryAction.PARENT_CHANGED,
          field: WorkItemHistoryField.PARENT,
          previousValue: oldParentId ?? null,
          newValue: newParentId ?? null,
        });
      }

      entries.push({
        workItemId: payload.id,
        actorId: userId,
        action: WorkItemHistoryAction.ORDER_CHANGED,
        field: WorkItemHistoryField.RANK,
        previousValue: String(item.backlog_rank),
        newValue: String(calculatedRank),
      });

      await this.history.recordMany(trx, entries);

      // Normalize ranks if any sibling ranks are too close (< 0.001 apart)
      // This prevents float precision issues over time
      await this.normalizeRanksIfNeeded(trx, projectId, newParentId ?? null);
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
    let query = trx
      .selectFrom('work_items')
      .where('project_id', '=', projectId);

    if (parentId) {
      query = query.where('parent_id', '=', parentId);
    } else {
      query = query.where('parent_id', 'is', null);
    }

    const siblings = await query
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
        .set({ backlog_rank: (i + 1) * 1000, version: sql`version + 1` })
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
    expectedVersions?: Record<string, number>,
  ): Promise<void> {
    if (itemIds.length === 0) return;

    await db.transaction().execute(async (trx) => {
      // Fetch old iteration ids for history
      const items = await trx
        .selectFrom('work_items')
        .where('id', 'in', itemIds)
        .where('project_id', '=', projectId)
        .select(['id', 'iteration_id', 'version'])
        .execute();

      if (expectedVersions) {
        for (const item of items) {
          const expected = expectedVersions[item.id];
          if (expected !== undefined && item.version !== expected) {
            throw new ConflictException(
              `Conflict: Work item ${item.id} was updated by another user (expected version ${expected}, actual version ${item.version})`,
            );
          }
        }
      }

      await trx
        .updateTable('work_items')
        .set({
          iteration_id: iterationId,
          updated_at: new Date(),
          version: sql`version + 1`,
        })
        .where('id', 'in', itemIds)
        .execute();

      const entries: WorkItemHistoryEntryInput[] = items.map((item) => ({
        workItemId: item.id,
        actorId: userId,
        action: WorkItemHistoryAction.ITERATION_CHANGED,
        field: WorkItemHistoryField.ITERATION,
        previousValue: item.iteration_id ?? null,
        newValue: iterationId ?? null,
      }));

      await this.history.recordMany(trx, entries);
    });
  }
}
