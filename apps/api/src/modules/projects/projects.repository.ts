import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { db } from '../../db/kysely.js';

export const DEFAULT_WORK_ITEM_STATES = [
  { name: 'To Do', key: 'TODO', color: '#94A3B8', sort_order: 0, is_done: false },
  { name: 'In Progress', key: 'IN_PROGRESS', color: '#3B82F6', sort_order: 1, is_done: false },
  { name: 'Done', key: 'DONE', color: '#22C55E', sort_order: 2, is_done: true },
];

@Injectable()
export class ProjectsRepository {
  async createProject(data: {
    name: string;
    key: string;
    description?: string;
    created_by: string;
    organization_id: string;
  }) {
    return await db.transaction().execute(async (trx) => {
      const project = await trx
        .insertInto('projects')
        .values({
          name: data.name,
          key: data.key,
          description: data.description || null,
          created_by: data.created_by,
          organization_id: data.organization_id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('work_item_states')
        .values(
          DEFAULT_WORK_ITEM_STATES.map((s) => ({
            project_id: project.id,
            name: s.name,
            key: s.key,
            color: s.color,
            sort_order: s.sort_order,
            is_done: s.is_done,
            is_default: true,
          })),
        )
        .execute();

      // Every project gets a default area and default team so the team model
      // works out of the box. The creator becomes the team admin.
      const area = await trx
        .insertInto('areas')
        .values({ project_id: project.id, name: data.name, parent_id: null })
        .returningAll()
        .executeTakeFirstOrThrow();

      const team = await trx
        .insertInto('teams')
        .values({
          project_id: project.id,
          name: `${data.name} Team`,
          description: `Default team for ${data.name}`,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('team_configurations')
        .values({
          team_id: team.id,
          board_config: { collapsedCategories: false, hideEmptyColumns: false },
          backlog_config: { showInProgressItems: false },
          default_area_id: area.id,
          default_iteration_id: null,
        })
        .execute();

      await trx
        .insertInto('team_areas')
        .values({ team_id: team.id, area_id: area.id })
        .execute();

      await trx
        .insertInto('team_members')
        .values({ team_id: team.id, user_id: data.created_by, role: 'ADMIN' })
        .execute();

      // Creator automatically becomes OWNER in project_members
      await trx
        .insertInto('project_members')
        .values({ project_id: project.id, user_id: data.created_by, role: 'OWNER' })
        .onConflict((oc) =>
          oc.columns(['project_id', 'user_id']).doUpdateSet({ role: 'OWNER' }),
        )
        .execute();

      return project;
    });
  }

  async getProjects(userId: string) {
    return await db
      .selectFrom('projects')
      .leftJoin('project_members', 'projects.id', 'project_members.project_id')
      .where((eb) =>
        eb.or([
          eb('projects.created_by', '=', userId),
          eb('project_members.user_id', '=', userId),
        ]),
      )
      .selectAll('projects')
      .distinct()
      .execute();
  }

  async getProjectById(id: string) {
    return await db
      .selectFrom('projects')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst();
  }

  async updateProject(id: string, data: any) {
    return await db
      .updateTable('projects')
      .set({ ...data, updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async deleteProject(id: string) {
    return await db.deleteFrom('projects').where('id', '=', id).execute();
  }

  async addMember(projectId: string, userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER') {
    return await db
      .insertInto('project_members')
      .values({ project_id: projectId, user_id: userId, role })
      .onConflict((oc) =>
        oc.columns(['project_id', 'user_id']).doUpdateSet({ role }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async getMembers(projectId: string) {
    return await db
      .selectFrom('project_members')
      .innerJoin('users', 'project_members.user_id', 'users.id')
      .where('project_members.project_id', '=', projectId)
      .select([
        'project_members.id',
        'users.id as userId',
        'users.name',
        'users.email',
        'users.avatar_url as avatarUrl',
        'project_members.role',
        'project_members.created_at as joinedAt',
      ])
      .execute();
  }

  async updateMemberRole(projectId: string, userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER') {
    return await db
      .updateTable('project_members')
      .set({ role })
      .where('project_id', '=', projectId)
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();
  }

  async removeMember(projectId: string, userId: string) {
    return await db
      .deleteFrom('project_members')
      .where('project_id', '=', projectId)
      .where('user_id', '=', userId)
      .execute();
  }

  async getProjectOverview(projectId: string) {
    const states = await db
      .selectFrom('work_item_states')
      .where('project_id', '=', projectId)
      .select(['key', 'is_done'])
      .orderBy('sort_order', 'asc')
      .execute();

    const firstStateKey = states[0]?.key;
    const doneStates = new Set(states.filter((s) => s.is_done).map((s) => s.key));

    // Aggregate counts in SQL instead of shipping every row to Node so
    // projects with a large work-item backlog stay O(states) not O(items).
    const groups = await db
      .selectFrom('work_items')
      .where('project_id', '=', projectId)
      .select(['state', 'type', sql<number>`count(*)::int`.as('count')])
      .groupBy(['state', 'type'])
      .execute();

    const stateCounts: Record<string, number> = {};
    let bugCount = 0;
    let total = 0;
    for (const g of groups) {
      stateCounts[g.state] = (stateCounts[g.state] || 0) + g.count;
      if (g.type === 'BUG') bugCount += g.count;
      total += g.count;
    }

    const activeIteration = await db
      .selectFrom('iterations')
      .where('project_id', '=', projectId)
      .where('state', '=', 'ACTIVE')
      .selectAll()
      .executeTakeFirst();

    const recentActivity = await db
      .selectFrom('work_item_history')
      .innerJoin('work_items', 'work_items.id', 'work_item_history.work_item_id')
      .innerJoin('users', 'users.id', 'work_item_history.user_id')
      .where('work_items.project_id', '=', projectId)
      .select([
        'work_item_history.id',
        'work_item_history.action',
        'work_item_history.field',
        'work_item_history.old_value',
        'work_item_history.new_value',
        'work_item_history.created_at',
        'work_items.seq_no as work_item_seq',
        'work_items.title as work_item_title',
        'users.name as user_name',
      ])
      .orderBy('work_item_history.created_at', 'desc')
      .limit(10)
      .execute();

    let activeIterationStats = null;
    if (activeIteration) {
      const iterationGroups = await db
        .selectFrom('work_items')
        .where('iteration_id', '=', activeIteration.id)
        .select(['state', sql<number>`count(*)::int`.as('count')])
        .groupBy('state')
        .execute();

      let completed = 0;
      let iterationTotal = 0;
      for (const g of iterationGroups) {
        if (doneStates.has(g.state)) completed += g.count;
        iterationTotal += g.count;
      }

      activeIterationStats = {
        ...activeIteration,
        completedItems: completed,
        remainingItems: iterationTotal - completed,
        totalItems: iterationTotal,
        progress: iterationTotal > 0 ? Math.round((completed / iterationTotal) * 100) : 0,
      };
    }

    const done = states
      .filter((s) => s.is_done)
      .reduce((sum, s) => sum + (stateCounts[s.key] || 0), 0);
    const todo = firstStateKey ? stateCounts[firstStateKey] || 0 : 0;

    const stats = {
      total,
      todo,
      inProgress: Math.max(0, total - todo - done),
      done,
      bugs: bugCount,
    };

    return {
      stats,
      activeIteration: activeIterationStats,
      recentActivity,
    };
  }

  async getAreas(projectId: string) {
    return await db.selectFrom('areas').where('project_id', '=', projectId).selectAll().execute();
  }

  async getTags(projectId: string) {
    return await db.selectFrom('tags').where('project_id', '=', projectId).selectAll().execute();
  }
}
