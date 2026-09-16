import { Injectable } from '@nestjs/common';
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

  async addMember(projectId: string, userId: string) {
    return await db
      .insertInto('project_members')
      .values({ project_id: projectId, user_id: userId })
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
        'project_members.created_at as joinedAt',
      ])
      .execute();
  }

  async removeMember(projectId: string, userId: string) {
    return await db
      .deleteFrom('project_members')
      .where('project_id', '=', projectId)
      .where('user_id', '=', userId)
      .execute();
  }

  async getProjectOverview(projectId: string) {
    const workItems = await db
      .selectFrom('work_items')
      .where('project_id', '=', projectId)
      .select(['id', 'state', 'type'])
      .execute();

    const states = await db
      .selectFrom('work_item_states')
      .where('project_id', '=', projectId)
      .select(['key', 'is_done'])
      .orderBy('sort_order', 'asc')
      .execute();

    const stateCounts: Record<string, number> = {};
    for (const item of workItems) {
      stateCounts[item.state] = (stateCounts[item.state] || 0) + 1;
    }

    const firstStateKey = states[0]?.key;
    const doneStates = new Set(states.filter((s) => s.is_done).map((s) => s.key));

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
      const iterationItems = await db
        .selectFrom('work_items')
        .where('iteration_id', '=', activeIteration.id)
        .select(['id', 'state'])
        .execute();

      const completed = iterationItems.filter((i) => doneStates.has(i.state)).length;
      const total = iterationItems.length;

      activeIterationStats = {
        ...activeIteration,
        completedItems: completed,
        remainingItems: total - completed,
        totalItems: total,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }

    const done = states
      .filter((s) => s.is_done)
      .reduce((sum, s) => sum + (stateCounts[s.key] || 0), 0);
    const todo = firstStateKey ? stateCounts[firstStateKey] || 0 : 0;

    const stats = {
      total: workItems.length,
      todo,
      inProgress: Math.max(0, workItems.length - todo - done),
      done,
      bugs: workItems.filter((i) => i.type === 'BUG').length,
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
