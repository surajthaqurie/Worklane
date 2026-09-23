import { CreateWorkItemDto, UpdateWorkItemDto } from "./dto/work-items.dto.js";
import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { sql, type SqlBool } from 'kysely';
import {
  WorkItemHistoryAction,
  WorkItemHistoryField,
  WorkItemHistoryEntryInput,
} from '../work-item-history/work-item-history.constants.js';
import { WorkItemHistoryService } from '../work-item-history/work-item-history.service.js';
import type { WorkItemType } from './work-item.types.js';
import { WipLimitExceededException } from '../../common/exceptions/wip-limit.exception.js';

/**
 * WIP (work-in-progress) constraint resolved from a board column and applied
 * atomically during a state transition so concurrent drag-and-drop moves can
 * never silently push a column past its limit.
 */
export interface WipConstraint {
  projectId: string;
  columnId: string;
  columnName: string;
  targetStates: string[];
  limit: number;
  /** Item being moved; never counted against the column's own total. */
  excludeItemId?: string;
  /** Board filter scope — counts only item types the board displays. */
  typeScope?: WorkItemType[];
  /**
   * Team scope — when the board is team-scoped, the limit is counted over the
   * team's visible items (its areas + iterations) only, so a team board's WIP
   * boundary is never hit by items the board does not display.
   */
  teamScope?: string | null;
}

@Injectable()
export class WorkItemsRepository {
  constructor(private readonly history: WorkItemHistoryService) {}
  async getIterationProjectId(iterationId: string): Promise<string | null> {
    const iteration = await db
      .selectFrom('iterations')
      .select('project_id')
      .where('id', '=', iterationId)
      .executeTakeFirst();
    return iteration?.project_id ?? null;
  }

  async getAreaProjectId(areaId: string): Promise<string | null> {
    const area = await db
      .selectFrom('areas')
      .select('project_id')
      .where('id', '=', areaId)
      .executeTakeFirst();
    return area?.project_id ?? null;
  }

  async getProjectStates(projectId: string): Promise<{ key: string; isDone: boolean; category: string }[]> {
    const rows = await db
      .selectFrom('work_item_states')
      .where('project_id', '=', projectId)
      .select(['key', 'is_done', 'category'])
      .orderBy('sort_order', 'asc')
      .execute();
    return rows.map((r) => ({ key: r.key, isDone: r.is_done, category: r.category }));
  }

  async createWorkItem(projectId: string, userId: string, data: CreateWorkItemDto) {
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
          severity: data.severity || 'MEDIUM',
          points: data.points || null,
          remaining_work: data.remainingWork !== undefined && data.remainingWork !== null ? Number(data.remainingWork) : null,
          completed_work: data.completedWork !== undefined && data.completedWork !== null ? Number(data.completedWork) : null,
          start_date: data.startDate ? new Date(data.startDate) : null,
          target_date: data.targetDate ? new Date(data.targetDate) : null,
          custom_fields: (data.customFields || {}) as any,
          assigned_to: data.assignedTo || null,
          created_by: userId,
          area_id: data.areaId || (await trx.selectFrom("areas").where("project_id", "=", projectId).select("id").limit(1).executeTakeFirst())?.id || "00000000-0000-0000-0000-000000000000",
          iteration_id: data.iterationId || null,
          closed_at: data.closedAt || null,
          backlog_order: seqNo,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      if (data.tags && data.tags.length > 0) {
        const existingTags = await trx.selectFrom('tags').where('project_id', '=', projectId).where('name', 'in', data.tags).selectAll().execute();
        const existingTagNames = existingTags.map(t => t.name);
        const newTagNames = data.tags.filter(t => !existingTagNames.includes(t));
        
        let allTags = [...existingTags];
        if (newTagNames.length > 0) {
          const insertedTags = await trx.insertInto('tags').values(newTagNames.map(name => ({ project_id: projectId, name }))).returningAll().execute();
          allTags = allTags.concat(insertedTags);
        }

        if (allTags.length > 0) {
          await trx.insertInto('work_item_tags').values(allTags.map(t => ({ work_item_id: item.id, tag_id: t.id }))).execute();
        }
      }
      await this.history.record(trx, {
        workItemId: item.id,
        actorId: userId,
        action: WorkItemHistoryAction.CREATED,
      });

      return item;
    });
  }

  async getWorkItems(projectId: string, filters: any) {
    let query = db.selectFrom('work_items').where('project_id', '=', projectId);

    if (filters.state) query = query.where('state', '=', filters.state);
    if (filters.type) query = query.where('type', '=', filters.type);
    if (filters.types) {
      const raw: string[] = Array.isArray(filters.types)
        ? filters.types
        : String(filters.types).split(',');
      const typesList: ('EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG')[] = raw
        .map((t: string) => String(t).trim())
        .filter((t: string) => Boolean(t)) as ('EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG')[];
      if (typesList.length > 0) query = query.where('type', 'in', typesList);
    }
    if (filters.priority)
      query = query.where('priority', '=', filters.priority);
    if (filters.assignedTo) {
      if (filters.assignedTo === 'UNASSIGNED') {
        query = query.where('assigned_to', 'is', null);
      } else {
        query = query.where('assigned_to', '=', filters.assignedTo);
      }
    }
    if (filters.iterationId && filters.iterationId !== 'undefined') {
      if (filters.iterationId === 'null') {
        query = query.where('iteration_id', 'is', null);
      } else {
        query = query.where('iteration_id', '=', filters.iterationId);
      }
    }
    
    if (filters.areaId) {
      query = query.where('area_id', '=', filters.areaId);
    }
    
    if (filters.teamId && filters.teamId !== 'default' && filters.teamId !== 'undefined') {
      // A team's view of project-scoped work: items in the team's areas, and in
      // the team's iterations (or not yet assigned to any iteration).
      query = query.where((eb) =>
        eb.and([
          eb(
            'area_id',
            'in',
            db.selectFrom('team_areas').where('team_id', '=', filters.teamId).select('area_id'),
          ),
          eb.or([
            eb('iteration_id', 'is', null),
            eb(
              'iteration_id',
              'in',
              db
                .selectFrom('team_iterations')
                .where('team_id', '=', filters.teamId)
                .select('iteration_id'),
            ),
          ]),
        ]),
      );
    }
    
    if (filters.tags) {
      const tagList = filters.tags.split(',').map((t: string) => t.trim());
      query = query.where((eb) =>
        eb('id', 'in',
          db.selectFrom('work_item_tags')
            .innerJoin('tags', 'tags.id', 'work_item_tags.tag_id')
            .where('tags.name', 'in', tagList)
            .select('work_item_tags.work_item_id')
        )
      );
    }
    
    if (filters.parentId !== undefined) {
      if (filters.parentId === 'null' || filters.parentId === '') {
        query = query.where('parent_id', 'is', null);
      } else {
        query = query.where('parent_id', '=', filters.parentId);
      }
    }

    if (filters.search) {
      const searchStr = String(filters.search).trim();
      query = query.where((eb) => {
        const conditions = [
          sql<SqlBool>`search_vector @@ plainto_tsquery('english', ${searchStr})`,
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

    // Lean list: `description` and `points` are payload-heavy and only needed
    // on detail views, so they are excluded by default. Callers that render
    // them (e.g. kanban cards) opt back in via `fields=description,points`.
    const leanColumns = [
      'id',
      'project_id',
      'seq_no',
      'parent_id',
      'type',
      'title',
      'state',
      'priority',
      'assigned_to',
      'created_by',
      'created_at',
      'updated_at',
      'completed_at',
      'iteration_id',
      'area_id',
      'backlog_order',
    ] as const;
    const optionalColumns: ('description' | 'points')[] = [];
    if (filters.fields) {
      const requestedFields = new Set(
        String(filters.fields)
          .split(',')
          .map((f: string) => f.trim())
          .filter(Boolean),
      );
      if (requestedFields.has('description')) optionalColumns.push('description');
      if (requestedFields.has('points')) optionalColumns.push('points');
    }

    const hasChildrenExpr = sql<boolean>`EXISTS (
      SELECT 1 FROM work_items AS children WHERE children.parent_id = work_items.id
    )`.as('has_children');

    return await query
      .select([...leanColumns, ...optionalColumns, hasChildrenExpr])
      .orderBy('backlog_order', 'asc')
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
    const item = await db
      .selectFrom('work_items')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst();
    if (!item) return undefined;
    
    const tags = await db
      .selectFrom('work_item_tags')
      .innerJoin('tags', 'tags.id', 'work_item_tags.tag_id')
      .where('work_item_tags.work_item_id', '=', id)
      .select('tags.name')
      .execute();
      
    return { ...item, tags: tags.map(t => t.name) };
  }

  async updateWorkItem(id: string, userId: string, data: UpdateWorkItemDto) {
    return await db.transaction().execute(async (trx) => {
      const oldItem = await trx
        .selectFrom('work_items')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirstOrThrow();

      const oldTags = await trx
        .selectFrom('work_item_tags')
        .innerJoin('tags', 'tags.id', 'work_item_tags.tag_id')
        .where('work_item_tags.work_item_id', '=', id)
        .select('tags.name')
        .execute();

      if (data.expectedVersion !== undefined && oldItem.version !== data.expectedVersion) {
        throw new ConflictException(
          `Conflict: Work item was updated by another user (expected version ${data.expectedVersion}, actual version ${oldItem.version})`,
        );
      }

      const updateData: any = {
        updated_at: new Date(),
        version: sql`version + 1`,
      };
      if (data.type !== undefined) updateData.type = data.type;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.severity !== undefined) updateData.severity = data.severity;
      if (data.points !== undefined) updateData.points = data.points;
      if (data.remainingWork !== undefined)
        updateData.remaining_work = data.remainingWork !== null ? Number(data.remainingWork) : null;
      if (data.completedWork !== undefined)
        updateData.completed_work = data.completedWork !== null ? Number(data.completedWork) : null;
      if (data.startDate !== undefined)
        updateData.start_date = data.startDate ? new Date(data.startDate) : null;
      if (data.targetDate !== undefined)
        updateData.target_date = data.targetDate ? new Date(data.targetDate) : null;
      if (data.customFields !== undefined)
        updateData.custom_fields = (data.customFields || {}) as any;
      if (data.backlogOrder !== undefined) updateData.backlog_order = data.backlogOrder;
      if (data.assignedTo !== undefined)
        updateData.assigned_to = data.assignedTo;
      if (data.parentId !== undefined) updateData.parent_id = data.parentId;
      if (data.iterationId !== undefined) updateData.iteration_id = data.iterationId;
      if (data.areaId !== undefined) updateData.area_id = data.areaId;
      if (data.closedAt !== undefined) updateData.closed_at = data.closedAt || null;

      let updateQuery = trx
        .updateTable('work_items')
        .set(updateData)
        .where('id', '=', id);

      if (data.expectedVersion !== undefined) {
        updateQuery = updateQuery.where('version', '=', data.expectedVersion);
      }

      const updated = await updateQuery
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        throw new ConflictException('Conflict: Work item was updated by another user.');
      }

      const entries: WorkItemHistoryEntryInput[] = [];

      if (data.tags !== undefined) {
        await trx.deleteFrom('work_item_tags').where('work_item_id', '=', id).execute();
        if (data.tags && data.tags.length > 0) {
          const existingTags = await trx.selectFrom('tags').where('project_id', '=', oldItem.project_id).where('name', 'in', data.tags).selectAll().execute();
          const existingTagNames = existingTags.map(t => t.name);
          const newTagNames = data.tags.filter(t => !existingTagNames.includes(t));

          let allTags = [...existingTags];
          if (newTagNames.length > 0) {
            const insertedTags = await trx.insertInto('tags').values(newTagNames.map(name => ({ project_id: oldItem.project_id, name }))).returningAll().execute();
            allTags = allTags.concat(insertedTags);
          }

          if (allTags.length > 0) {
            await trx.insertInto('work_item_tags').values(allTags.map(t => ({ work_item_id: id, tag_id: t.id }))).execute();
          }
        }

        const previousTags = oldTags.map((t) => t.name).sort();
        const nextTags = [...(data.tags ?? [])].sort();
        entries.push({
          workItemId: id,
          actorId: userId,
          action: WorkItemHistoryAction.TAGS_CHANGED,
          field: WorkItemHistoryField.TAGS,
          previousValue: previousTags.length > 0 ? previousTags.join(',') : null,
          newValue: nextTags.length > 0 ? nextTags.join(',') : null,
        });
      }

      const trackFields: { key: keyof UpdateWorkItemDto; dbKey: string; action: WorkItemHistoryAction }[] = [
        { key: 'title', dbKey: 'title', action: WorkItemHistoryAction.TITLE_CHANGED },
        { key: 'type', dbKey: 'type', action: WorkItemHistoryAction.TYPE_CHANGED },
        { key: 'priority', dbKey: 'priority', action: WorkItemHistoryAction.PRIORITY_CHANGED },
        { key: 'points', dbKey: 'points', action: WorkItemHistoryAction.POINTS_CHANGED },
        { key: 'assignedTo', dbKey: 'assigned_to', action: WorkItemHistoryAction.ASSIGNEE_CHANGED },
        {
          key: 'description',
          dbKey: 'description',
          action: WorkItemHistoryAction.DESCRIPTION_CHANGED,
        },
        { key: 'parentId', dbKey: 'parent_id', action: WorkItemHistoryAction.PARENT_CHANGED },
        { key: 'iterationId', dbKey: 'iteration_id', action: WorkItemHistoryAction.ITERATION_CHANGED },
        { key: 'areaId', dbKey: 'area_id', action: WorkItemHistoryAction.AREA_CHANGED },
        { key: 'backlogOrder', dbKey: 'backlog_order', action: WorkItemHistoryAction.ORDER_CHANGED },
      ];

      for (const field of trackFields) {
        if (
          data[field.key] !== undefined &&
          (oldItem[field.dbKey as keyof typeof oldItem] ?? null) !==
            (updated[field.dbKey as keyof typeof updated] ?? null)
        ) {
          entries.push({
            workItemId: id,
            actorId: userId,
            action: field.action,
            field: field.dbKey,
            previousValue: this.stringify(oldItem[field.dbKey as keyof typeof oldItem]),
            newValue: this.stringify(updated[field.dbKey as keyof typeof updated]),
          });
        }
      }

      if (entries.length > 0) {
        await this.history.recordMany(trx, entries);
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

      // Immutable audit record survives deletion (history is append-only)
      await this.history.record(trx, {
        workItemId: id,
        actorId: userId,
        action: WorkItemHistoryAction.DELETED,
        previousValue: item?.title ?? null,
      });

      await trx.deleteFrom('work_items').where('id', '=', id).execute();
    });
  }

  async getComments(workItemId: string, opts: { limit: number; cursor?: string }) {
    let query = db
      .selectFrom('work_item_comments')
      .innerJoin('users', 'users.id', 'work_item_comments.user_id')
      .where('work_item_comments.work_item_id', '=', workItemId)
      .where('work_item_comments.deleted_at', 'is', null)
      .select([
        'work_item_comments.id',
        'work_item_comments.content',
        'work_item_comments.version',
        'work_item_comments.created_at',
        'work_item_comments.updated_at',
        'work_item_comments.user_id',
        'users.name as user_name',
        'users.avatar_url as user_avatar_url',
      ]);

    if (opts.cursor) {
      const cursorRow = await db
        .selectFrom('work_item_comments')
        .where('id', '=', opts.cursor)
        .select(['created_at', 'id'])
        .executeTakeFirst();

      if (cursorRow) {
        query = query.where((eb) =>
          eb.or([
            eb('work_item_comments.created_at', '>', cursorRow.created_at),
            eb.and([
              eb('work_item_comments.created_at', '=', cursorRow.created_at),
              eb('work_item_comments.id', '>', cursorRow.id),
            ]),
          ]),
        );
      }
    }

    const items = await query
      .orderBy('work_item_comments.created_at', 'asc')
      .orderBy('work_item_comments.id', 'asc')
      .limit(opts.limit + 1)
      .execute();

    const hasMore = items.length > opts.limit;
    const pageItems = hasMore ? items.slice(0, opts.limit) : items;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1].id : null;

    return {
      items: pageItems.map((c) => ({
        id: c.id,
        workItemId,
        authorId: c.user_id,
        authorName: c.user_name,
        authorAvatarUrl: c.user_avatar_url,
        content: c.content,
        version: c.version,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
      nextCursor,
    };
  }

  async createComment(workItemId: string, userId: string, content: string) {
    const comment = await db
      .insertInto('work_item_comments')
      .values({ work_item_id: workItemId, user_id: userId, content })
      .returningAll()
      .executeTakeFirstOrThrow();

    await this.history.record(db, {
      workItemId,
      actorId: userId,
      action: WorkItemHistoryAction.COMMENT_ADDED,
      field: WorkItemHistoryField.COMMENT,
      newValue: content,
    });

    return {
      id: comment.id,
      workItemId,
      authorId: comment.user_id,
      content: comment.content,
      version: comment.version,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    };
  }

  async updateComment(
    commentId: string,
    userId: string,
    content: string,
    expectedVersion: number,
  ) {
    const existing = await db
      .selectFrom('work_item_comments')
      .where('id', '=', commentId)
      .where('deleted_at', 'is', null)
      .select([
        'id',
        'work_item_id',
        'content',
        'version',
        'user_id',
        'created_at',
        'updated_at',
      ])
      .executeTakeFirst();

    if (!existing) {
      throw new NotFoundException('Comment not found');
    }

    if (existing.user_id !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    if (existing.version !== expectedVersion) {
      throw new ConflictException(
        'Concurrent update detected: comment has been modified since it was loaded',
      );
    }

    if (existing.content === content) {
      return existing;
    }

    const updated = await db
      .updateTable('work_item_comments')
      .set({
        content,
        updated_at: new Date(),
        version: existing.version + 1,
      })
      .where('id', '=', commentId)
      .where('version', '=', expectedVersion)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      throw new ConflictException(
        'Concurrent update detected: comment has been modified since it was loaded',
      );
    }

    if (existing.content !== content) {
      await this.history.record(db, {
        workItemId: existing.work_item_id,
        actorId: userId,
        action: WorkItemHistoryAction.COMMENT_UPDATED,
        field: WorkItemHistoryField.COMMENT,
        previousValue: existing.content,
        newValue: content,
      });
    }

    return updated;
  }

  async deleteComment(
    commentId: string,
    userId: string,
    expectedVersion: number,
  ) {
    const existing = await db
      .selectFrom('work_item_comments')
      .where('id', '=', commentId)
      .where('deleted_at', 'is', null)
      .select(['id', 'work_item_id', 'content', 'version'])
      .executeTakeFirst();

    if (!existing) {
      throw new NotFoundException('Comment not found');
    }

    if (existing.version !== expectedVersion) {
      throw new ConflictException(
        'Concurrent update detected: comment has been modified since it was loaded',
      );
    }

    const updated = await db
      .updateTable('work_item_comments')
      .set({ deleted_at: new Date() })
      .where('id', '=', commentId)
      .where('version', '=', expectedVersion)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      throw new ConflictException(
        'Concurrent update detected: comment has been modified since it was loaded',
      );
    }

    await this.history.record(db, {
      workItemId: existing.work_item_id,
      actorId: userId,
      action: WorkItemHistoryAction.COMMENT_DELETED,
      field: WorkItemHistoryField.COMMENT,
      previousValue: existing.content,
    });

    return { success: true };
  }

  async updateState(
    id: string,
    userId: string,
    oldState: string,
    newState: string,
    isDone: boolean,
    expectedVersion?: number,
    wipConstraint?: WipConstraint,
  ) {
    return await db.transaction().execute(async (trx) => {
      // WIP is enforced inside the same transaction that mutates the item so a
      // lock on the target column's rows serializes concurrent moves. `FOR
      // UPDATE` re-reads the latest committed rows under READ COMMITTED, so the
      // second move in a race sees the first move's result and is rejected.
      if (wipConstraint) {
        let scope = trx
          .selectFrom('work_items')
          .select('id')
          .where('project_id', '=', wipConstraint.projectId)
          .where('state', 'in', wipConstraint.targetStates);
        if (wipConstraint.excludeItemId) {
          scope = scope.where('id', '!=', wipConstraint.excludeItemId);
        }
        if (wipConstraint.typeScope && wipConstraint.typeScope.length > 0) {
          scope = scope.where('type', 'in', wipConstraint.typeScope);
        }
        if (wipConstraint.teamScope) {
          scope = scope.where((eb) =>
            eb.and([
              eb(
                'area_id',
                'in',
                trx
                  .selectFrom('team_areas')
                  .where('team_id', '=', wipConstraint.teamScope!)
                  .select('area_id'),
              ),
              eb.or([
                eb('iteration_id', 'is', null),
                eb(
                  'iteration_id',
                  'in',
                  trx
                    .selectFrom('team_iterations')
                    .where('team_id', '=', wipConstraint.teamScope!)
                    .select('iteration_id'),
                ),
              ]),
            ]),
          );
        }
        const inColumn = await scope.forUpdate().execute();
        if (inColumn.length >= wipConstraint.limit) {
          throw new WipLimitExceededException({
            columnId: wipConstraint.columnId,
            columnName: wipConstraint.columnName,
            currentCount: inColumn.length,
            wipLimit: wipConstraint.limit,
          });
        }
      }

      const now = new Date();
      const updateData: any = {
        state: newState,
        updated_at: now,
        completed_at: isDone ? now : null,
        closed_at: isDone ? now : null,
        version: sql`version + 1`,
      };

      let query = trx
        .updateTable('work_items')
        .set(updateData)
        .where('id', '=', id)
        .where('state', '=', oldState);

      if (expectedVersion !== undefined) {
        query = query.where('version', '=', expectedVersion);
      }

      const updated = await query.returningAll().executeTakeFirst();

      if (!updated) {
        throw new ConflictException('Concurrent update detected: Work item state or version has changed since it was loaded');
      }

      await this.history.record(trx, {
        workItemId: id,
        actorId: userId,
        action: WorkItemHistoryAction.STATE_CHANGED,
        field: WorkItemHistoryField.STATE,
        previousValue: oldState,
        newValue: newState,
      });

      return updated;
    });
  }

  async getActivity(workItemId: string) {
    return await this.history.getActivity(workItemId);
  }

  async getBatchRollups(projectId: string, itemIds: string[]): Promise<Record<string, {
    itemId: string;
    descendantCount: number;
    completedCount: number;
    totalPoints: number;
    completedPoints: number;
    remainingWork: number;
    completedWork: number;
    completionPercentage: number;
  }>> {
    if (itemIds.length === 0) return {};

    const query = sql<any>`
      WITH RECURSIVE tree AS (
        SELECT 
          wi.id AS root_id, 
          wi.id, 
          wi.project_id, 
          wi.type, 
          wi.state, 
          wi.points,
          wi.remaining_work, 
          wi.completed_work, 
          wis.category AS state_category, 
          wis.is_done,
          ARRAY[wi.id] AS path, 
          0 AS depth
        FROM work_items wi
        LEFT JOIN work_item_states wis ON wis.project_id = wi.project_id AND wis.key = wi.state
        WHERE wi.id = ANY(${itemIds}::uuid[]) AND wi.project_id = ${projectId}

        UNION ALL

        SELECT 
          t.root_id, 
          ch.id, 
          ch.project_id, 
          ch.type, 
          ch.state, 
          ch.points,
          ch.remaining_work, 
          ch.completed_work, 
          wis.category AS state_category, 
          wis.is_done,
          t.path || ch.id, 
          t.depth + 1
        FROM work_items ch
        JOIN tree t ON ch.parent_id = t.id AND ch.project_id = t.project_id
        LEFT JOIN work_item_states wis ON wis.project_id = ch.project_id AND wis.key = ch.state
        WHERE t.depth < 10 AND NOT (ch.id = ANY(t.path))
      )
      SELECT 
        root_id,
        (COUNT(*) - 1)::int AS descendant_count,
        (COUNT(*) FILTER (WHERE depth > 0 AND (state_category = 'COMPLETED' OR is_done = TRUE)))::int AS completed_count,
        COALESCE(SUM(points), 0)::float AS total_points,
        COALESCE(SUM(points) FILTER (WHERE state_category = 'COMPLETED' OR is_done = TRUE), 0)::float AS completed_points,
        COALESCE(SUM(remaining_work), 0)::float AS remaining_work,
        COALESCE(SUM(completed_work), 0)::float AS completed_work
      FROM tree
      GROUP BY root_id;
    `;

    const result = await query.execute(db);

    const resultMap: Record<string, {
      itemId: string;
      descendantCount: number;
      completedCount: number;
      totalPoints: number;
      completedPoints: number;
      remainingWork: number;
      completedWork: number;
      completionPercentage: number;
    }> = {};

    for (const id of itemIds) {
      resultMap[id] = {
        itemId: id,
        descendantCount: 0,
        completedCount: 0,
        totalPoints: 0,
        completedPoints: 0,
        remainingWork: 0,
        completedWork: 0,
        completionPercentage: 0,
      };
    }

    for (const row of result.rows) {
      const rootId = row.root_id;
      const descendantCount = Number(row.descendant_count) || 0;
      const completedCount = Number(row.completed_count) || 0;
      const totalPoints = Number(row.total_points) || 0;
      const completedPoints = Number(row.completed_points) || 0;
      const remainingWork = Number(row.remaining_work) || 0;
      const completedWork = Number(row.completed_work) || 0;

      let completionPercentage = 0;
      if (totalPoints > 0) {
        completionPercentage = Math.round((completedPoints / totalPoints) * 100);
      } else if (descendantCount > 0) {
        completionPercentage = Math.round((completedCount / descendantCount) * 100);
      }

      resultMap[rootId] = {
        itemId: rootId,
        descendantCount,
        completedCount,
        totalPoints,
        completedPoints,
        remainingWork,
        completedWork,
        completionPercentage: Math.min(100, Math.max(0, completionPercentage)),
      };
    }

    return resultMap;
  }

  async getHierarchyTree(projectId: string, itemId: string) {
    const descendantQuery = sql<any>`
      WITH RECURSIVE tree AS (
        SELECT 
          wi.id, 
          wi.project_id, 
          wi.parent_id,
          wi.type, 
          wi.title,
          wi.state, 
          wi.priority,
          wi.severity,
          wi.points,
          wi.remaining_work, 
          wi.completed_work, 
          wi.assigned_to,
          wis.category AS state_category, 
          wis.is_done,
          ARRAY[wi.id] AS path, 
          0 AS depth
        FROM work_items wi
        LEFT JOIN work_item_states wis ON wis.project_id = wi.project_id AND wis.key = wi.state
        WHERE wi.id = ${itemId} AND wi.project_id = ${projectId}

        UNION ALL

        SELECT 
          ch.id, 
          ch.project_id, 
          ch.parent_id,
          ch.type, 
          ch.title,
          ch.state, 
          ch.priority,
          ch.severity,
          ch.points,
          ch.remaining_work, 
          ch.completed_work, 
          ch.assigned_to,
          wis.category AS state_category, 
          wis.is_done,
          t.path || ch.id, 
          t.depth + 1
        FROM work_items ch
        JOIN tree t ON ch.parent_id = t.id AND ch.project_id = t.project_id
        LEFT JOIN work_item_states wis ON wis.project_id = ch.project_id AND wis.key = ch.state
        WHERE t.depth < 10 AND NOT (ch.id = ANY(t.path))
      )
      SELECT * FROM tree ORDER BY depth ASC, title ASC;
    `;

    const ancestorQuery = sql<any>`
      WITH RECURSIVE ancestors AS (
        SELECT 
          wi.id, wi.project_id, wi.parent_id, wi.type, wi.title, wi.state, 0 AS depth
        FROM work_items wi
        WHERE wi.id = ${itemId} AND wi.project_id = ${projectId}

        UNION ALL

        SELECT 
          p.id, p.project_id, p.parent_id, p.type, p.title, p.state, a.depth + 1
        FROM work_items p
        JOIN ancestors a ON a.parent_id = p.id AND a.project_id = p.project_id
        WHERE a.depth < 10
      )
      SELECT * FROM ancestors WHERE id != ${itemId} ORDER BY depth DESC;
    `;

    const [descResult, ancResult] = await Promise.all([
      descendantQuery.execute(db),
      ancestorQuery.execute(db),
    ]);

    if (descResult.rows.length === 0) {
      return null;
    }

    const allIds = descResult.rows.map((r) => r.id);
    const rollups = await this.getBatchRollups(projectId, allIds);

    const nodeMap = new Map<string, any>();
    for (const row of descResult.rows) {
      nodeMap.set(row.id, {
        id: row.id,
        projectId: row.project_id,
        parentId: row.parent_id,
        type: row.type,
        title: row.title,
        state: row.state,
        stateCategory: row.state_category || 'PROPOSED',
        isDone: Boolean(row.is_done),
        priority: row.priority,
        severity: row.severity,
        points: row.points !== null ? Number(row.points) : null,
        remainingWork: row.remaining_work !== null ? Number(row.remaining_work) : null,
        completedWork: row.completed_work !== null ? Number(row.completed_work) : null,
        assignedTo: row.assigned_to,
        depth: Number(row.depth),
        children: [],
        rollup: rollups[row.id],
      });
    }

    let rootNode: any = null;
    for (const node of nodeMap.values()) {
      if (node.id === itemId) {
        rootNode = node;
      }
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
      }
    }

    const ancestors = ancResult.rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      parentId: r.parent_id,
      type: r.type,
      title: r.title,
      state: r.state,
    }));

    return {
      item: rootNode,
      ancestors,
      rollup: rollups[itemId],
    };
  }
}
