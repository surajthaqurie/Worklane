import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { db } from '../../db/kysely.js';
import type {
  DashboardActivityItem,
  DashboardBlockedItem,
  DashboardTeamMemberProgress,
  DashboardWorkItem,
  WidgetLayoutDto,
} from './dto/dashboard.dto.js';

@Injectable()
export class DashboardsRepository {
  async getLayout(userId: string, projectId: string | null) {
    let query = db
      .selectFrom('dashboard_layouts')
      .selectAll()
      .where('user_id', '=', userId);

    if (projectId) {
      query = query.where('project_id', '=', projectId);
    } else {
      query = query.where('project_id', 'is', null);
    }

    return await query.executeTakeFirst();
  }

  async upsertLayout(
    userId: string,
    projectId: string | null,
    widgets: WidgetLayoutDto[],
  ) {
    return await db.transaction().execute(async (trx) => {
      let existingQuery = trx
        .selectFrom('dashboard_layouts')
        .select('id')
        .where('user_id', '=', userId);

      if (projectId) {
        existingQuery = existingQuery.where('project_id', '=', projectId);
      } else {
        existingQuery = existingQuery.where('project_id', 'is', null);
      }

      const existing = await existingQuery.executeTakeFirst();

      if (existing) {
        return await trx
          .updateTable('dashboard_layouts')
          .set({
            widgets: widgets as any,
            updated_at: new Date(),
          })
          .where('id', '=', existing.id)
          .returningAll()
          .executeTakeFirstOrThrow();
      }

      return await trx
        .insertInto('dashboard_layouts')
        .values({
          user_id: userId,
          project_id: projectId,
          widgets: widgets as any,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  async deleteLayout(userId: string, projectId: string | null) {
    let query = db
      .deleteFrom('dashboard_layouts')
      .where('user_id', '=', userId);

    if (projectId) {
      query = query.where('project_id', '=', projectId);
    } else {
      query = query.where('project_id', 'is', null);
    }

    return await query.execute();
  }

  // ─── Query Aggregations for Batch Dashboard Data ───────────────────────────

  async getActiveIteration(projectId: string) {
    return await db
      .selectFrom('iterations')
      .selectAll()
      .where('project_id', '=', projectId)
      .where('state', '=', 'ACTIVE')
      .orderBy('start_date', 'asc')
      .limit(1)
      .executeTakeFirst();
  }

  async getIterationStats(iterationId: string) {
    return await db
      .selectFrom('work_items')
      .innerJoin('work_item_states', 'work_item_states.key', 'work_items.state')
      .where('work_items.iteration_id', '=', iterationId)
      .select([
        'work_items.state',
        'work_item_states.category',
        'work_item_states.is_done',
        sql<number>`count(*)::int`.as('count'),
        sql<number>`coalesce(sum(work_items.points), 0)::int`.as('points'),
      ])
      .groupBy(['work_items.state', 'work_item_states.category', 'work_item_states.is_done'])
      .execute();
  }

  async getUserWorkItems(userId: string, projectId: string | null, limit = 15): Promise<DashboardWorkItem[]> {
    let query = db
      .selectFrom('work_items')
      .innerJoin('projects', 'projects.id', 'work_items.project_id')
      .where('work_items.assigned_to', '=', userId)
      .select([
        'work_items.id',
        'work_items.seq_no as seqNo',
        'projects.key as projectKey',
        'work_items.title',
        'work_items.type',
        'work_items.state',
        'work_items.priority',
        'work_items.points',
        'work_items.updated_at as updatedAt',
      ])
      .orderBy('work_items.updated_at', 'desc')
      .limit(limit);

    if (projectId) {
      query = query.where('work_items.project_id', '=', projectId);
    }

    const rows = await query.execute();
    return rows.map((r) => ({
      id: r.id,
      seqNo: r.seqNo,
      projectKey: r.projectKey,
      title: r.title,
      type: r.type,
      state: r.state,
      priority: r.priority,
      points: r.points,
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
    }));
  }

  async getBlockedWorkItems(projectId: string | null, limit = 15): Promise<DashboardBlockedItem[]> {
    // 1. Find items linked by DEPENDS_ON where target item is not done
    let query = db
      .selectFrom('work_item_links')
      .innerJoin('work_items as source_item', 'source_item.id', 'work_item_links.source_work_item_id')
      .innerJoin('work_items as target_item', 'target_item.id', 'work_item_links.target_work_item_id')
      .innerJoin('work_item_states as target_state', (join) =>
        join.onRef('target_state.key', '=', 'target_item.state')
            .onRef('target_state.project_id', '=', 'target_item.project_id')
      )
      .innerJoin('projects as source_proj', 'source_proj.id', 'source_item.project_id')
      .innerJoin('projects as target_proj', 'target_proj.id', 'target_item.project_id')
      .where('work_item_links.link_type', '=', 'DEPENDS_ON')
      .where('target_state.is_done', '=', false)
      .select([
        'source_item.id as sourceId',
        'source_item.seq_no as sourceSeqNo',
        'source_proj.key as sourceKey',
        'source_item.title as sourceTitle',
        'source_item.type as sourceType',
        'source_item.state as sourceState',
        'source_item.priority as sourcePriority',
        'target_item.id as targetId',
        'target_item.seq_no as targetSeqNo',
        'target_proj.key as targetKey',
        'target_item.title as targetTitle',
        'target_item.state as targetState',
      ])
      .limit(limit);

    if (projectId) {
      query = query.where('work_item_links.project_id', '=', projectId);
    }

    const depRows = await query.execute();

    const items: DashboardBlockedItem[] = depRows.map((r) => ({
      id: r.sourceId,
      seqNo: r.sourceSeqNo,
      projectKey: r.sourceKey,
      title: r.sourceTitle,
      type: r.sourceType,
      state: r.sourceState,
      priority: r.sourcePriority,
      blockedBy: {
        id: r.targetId,
        seqNo: r.targetSeqNo,
        projectKey: r.targetKey,
        title: r.targetTitle,
        state: r.targetState,
      },
      reason: `Blocked by ${r.targetKey}-${r.targetSeqNo} (${r.targetState})`,
    }));

    // If fewer than limit, also look for items marked with CRITICAL / URGENT issues
    if (items.length < limit) {
      const remainingLimit = limit - items.length;
      const seenIds = new Set(items.map((i) => i.id));

      let critQuery = db
        .selectFrom('work_items')
        .innerJoin('projects', 'projects.id', 'work_items.project_id')
        .innerJoin('work_item_states', (join) =>
          join.onRef('work_item_states.key', '=', 'work_items.state')
              .onRef('work_item_states.project_id', '=', 'work_items.project_id')
        )
        .where('work_item_states.is_done', '=', false)
        .where((eb) =>
          eb.or([
            eb('work_items.priority', '=', 'URGENT'),
            eb('work_items.severity', '=', 'CRITICAL'),
          ])
        )
        .select([
          'work_items.id',
          'work_items.seq_no as seqNo',
          'projects.key as projectKey',
          'work_items.title',
          'work_items.type',
          'work_items.state',
          'work_items.priority',
          'work_items.severity',
        ])
        .orderBy('work_items.updated_at', 'desc')
        .limit(remainingLimit * 2);

      if (projectId) {
        critQuery = critQuery.where('work_items.project_id', '=', projectId);
      }

      const critRows = await critQuery.execute();
      for (const r of critRows) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          items.push({
            id: r.id,
            seqNo: r.seqNo,
            projectKey: r.projectKey,
            title: r.title,
            type: r.type,
            state: r.state,
            priority: r.priority,
            blockedBy: null,
            reason: r.severity === 'CRITICAL' ? 'Critical issue requiring immediate resolution' : 'Urgent priority blocker',
          });
          if (items.length >= limit) break;
        }
      }
    }

    return items;
  }

  async getRecentActivities(projectId: string | null, limit = 15): Promise<DashboardActivityItem[]> {
    let query = db
      .selectFrom('work_item_history')
      .innerJoin('work_items', 'work_items.id', 'work_item_history.work_item_id')
      .innerJoin('users', 'users.id', 'work_item_history.user_id')
      .select([
        'work_item_history.id',
        'work_item_history.action',
        'work_item_history.field',
        'work_item_history.old_value as oldValue',
        'work_item_history.new_value as newValue',
        'work_item_history.created_at as createdAt',
        'work_items.seq_no as workItemSeq',
        'work_items.title as workItemTitle',
        'users.name as userName',
        'users.avatar_url as userAvatar',
      ])
      .orderBy('work_item_history.created_at', 'desc')
      .limit(limit);

    if (projectId) {
      query = query.where('work_items.project_id', '=', projectId);
    }

    const rows = await query.execute();
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      field: r.field,
      oldValue: r.oldValue,
      newValue: r.newValue,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      workItemSeq: r.workItemSeq,
      workItemTitle: r.workItemTitle,
      userName: r.userName,
      userAvatar: r.userAvatar,
    }));
  }

  async getTeamProgress(projectId: string, teamId: string | null): Promise<DashboardTeamMemberProgress[]> {
    // Collect users that are members of the project or team
    const members = teamId
      ? await db
          .selectFrom('team_members')
          .innerJoin('users', 'users.id', 'team_members.user_id')
          .where('team_members.team_id', '=', teamId)
          .select(['users.id as userId', 'users.name', 'users.avatar_url as avatarUrl'])
          .execute()
      : await db
          .selectFrom('project_members')
          .innerJoin('users', 'users.id', 'project_members.user_id')
          .where('project_members.project_id', '=', projectId)
          .select(['users.id as userId', 'users.name', 'users.avatar_url as avatarUrl'])
          .execute();

    if (members.length === 0) {
      return [];
    }

    const userIds = members.map((m) => m.userId);

    // Aggregate work items assigned to these members in the project
    const itemStats = await db
      .selectFrom('work_items')
      .innerJoin('work_item_states', (join) =>
        join.onRef('work_item_states.key', '=', 'work_items.state')
            .onRef('work_item_states.project_id', '=', 'work_items.project_id')
      )
      .where('work_items.project_id', '=', projectId)
      .where('work_items.assigned_to', 'in', userIds)
      .select([
        'work_items.assigned_to as userId',
        'work_item_states.category',
        'work_item_states.is_done as isDone',
        sql<number>`count(*)::int`.as('count'),
        sql<number>`coalesce(sum(work_items.points), 0)::int`.as('points'),
      ])
      .groupBy(['work_items.assigned_to', 'work_item_states.category', 'work_item_states.is_done'])
      .execute();

    const progressMap = new Map<
      string,
      { assignedCount: number; inProgressCount: number; doneCount: number; totalPoints: number }
    >();

    for (const row of itemStats) {
      if (!row.userId) continue;
      const cur = progressMap.get(row.userId) || {
        assignedCount: 0,
        inProgressCount: 0,
        doneCount: 0,
        totalPoints: 0,
      };

      cur.assignedCount += row.count;
      cur.totalPoints += row.points;
      if (row.isDone) {
        cur.doneCount += row.count;
      } else if (row.category === 'IN_PROGRESS') {
        cur.inProgressCount += row.count;
      }
      progressMap.set(row.userId, cur);
    }

    return members.map((m) => {
      const stats = progressMap.get(m.userId) || {
        assignedCount: 0,
        inProgressCount: 0,
        doneCount: 0,
        totalPoints: 0,
      };
      return {
        userId: m.userId,
        name: m.name,
        avatarUrl: m.avatarUrl,
        assignedCount: stats.assignedCount,
        inProgressCount: stats.inProgressCount,
        doneCount: stats.doneCount,
        totalPoints: stats.totalPoints,
      };
    });
  }

  async getPastIterations(projectId: string, limit = 5) {
    return await db
      .selectFrom('iterations')
      .selectAll()
      .where('project_id', '=', projectId)
      .orderBy('end_date', 'desc')
      .limit(limit)
      .execute();
  }
}
