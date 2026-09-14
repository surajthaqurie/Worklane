import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';

@Injectable()
export class ProjectsRepository {
  async createProject(data: {
    name: string;
    key: string;
    description?: string;
    created_by: string;
  }) {
    return await db
      .insertInto('projects')
      .values({
        name: data.name,
        key: data.key,
        description: data.description || null,
        created_by: data.created_by,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
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

    const activeSprint = await db
      .selectFrom('sprints')
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

    let activeSprintStats = null;
    if (activeSprint) {
      const sprintItems = await db
        .selectFrom('work_items')
        .where('sprint_id', '=', activeSprint.id)
        .select(['id', 'state'])
        .execute();
      
      const completed = sprintItems.filter(i => i.state === 'DONE').length;
      const total = sprintItems.length;
      
      activeSprintStats = {
        ...activeSprint,
        completedItems: completed,
        remainingItems: total - completed,
        totalItems: total,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }

    const stats = {
      total: workItems.length,
      todo: workItems.filter(i => i.state === 'TODO').length,
      inProgress: workItems.filter(i => i.state === 'IN_PROGRESS').length,
      done: workItems.filter(i => i.state === 'DONE').length,
      bugs: workItems.filter(i => i.type === 'BUG').length,
    };

    return {
      stats,
      activeSprint: activeSprintStats,
      recentActivity,
    };
  }
}
