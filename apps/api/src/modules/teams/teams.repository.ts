import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { sql } from 'kysely';

export type TeamRole = 'ADMIN' | 'MEMBER';

export interface TeamSettings {
  boardConfig: Record<string, unknown>;
  backlogConfig: Record<string, unknown>;
  defaultIterationId: string | null;
  defaultAreaId: string | null;
  iterations: string[];
  areas: string[];
}

export interface TeamMemberRow {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: TeamRole;
  createdAt: Date;
}

@Injectable()
export class TeamsRepository {
  async listByProject(projectId: string, userId: string) {
    const teams = await db
      .selectFrom('teams')
      .where('project_id', '=', projectId)
      .selectAll()
      .orderBy('created_at', 'asc')
      .orderBy('name', 'asc')
      .execute();

    const countRows = await db
      .selectFrom('team_members')
      .innerJoin('teams', 'teams.id', 'team_members.team_id')
      .where('teams.project_id', '=', projectId)
      .select(['team_members.team_id', sql<number>`count(*)::int`.as('count')])
      .groupBy('team_members.team_id')
      .execute();

    const myRows = await db
      .selectFrom('team_members')
      .innerJoin('teams', 'teams.id', 'team_members.team_id')
      .where('teams.project_id', '=', projectId)
      .where('team_members.user_id', '=', userId)
      .select(['team_members.team_id', 'team_members.role'])
      .execute();

    const countByTeam = new Map(countRows.map((r) => [r.team_id, Number(r.count)]));
    const roleByTeam = new Map(myRows.map((r) => [r.team_id, r.role]));

    return teams.map((t) => ({
      id: t.id,
      projectId: t.project_id,
      name: t.name,
      description: t.description,
      createdAt: t.created_at,
      memberCount: countByTeam.get(t.id) ?? 0,
      userRole: roleByTeam.get(t.id) ?? null,
    }));
  }

  async getById(projectId: string, teamId: string) {
    const team = await db
      .selectFrom('teams')
      .where('id', '=', teamId)
      .where('project_id', '=', projectId)
      .selectAll()
      .executeTakeFirst();
    return team ?? null;
  }

  async getMember(teamId: string, userId: string) {
    return await db
      .selectFrom('team_members')
      .where('team_id', '=', teamId)
      .where('user_id', '=', userId)
      .selectAll()
      .executeTakeFirst();
  }

  async create(projectId: string, name: string, description: string | null) {
    return await db.transaction().execute(async (trx) => {
      const team = await trx
        .insertInto('teams')
        .values({ project_id: projectId, name, description })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('team_configurations')
        .values({
          team_id: team.id,
          board_config: { collapsedCategories: false, hideEmptyColumns: false },
          backlog_config: { showInProgressItems: false },
          default_iteration_id: await trx
            .selectFrom('iterations')
            .where('project_id', '=', projectId)
            .where('state', '=', 'ACTIVE')
            .select('id')
            .limit(1)
            .executeTakeFirst()
            .then((r) => r?.id ?? null),
          default_area_id: await trx
            .selectFrom('areas')
            .where('project_id', '=', projectId)
            .where('parent_id', 'is', null)
            .select('id')
            .orderBy('created_at', 'asc')
            .limit(1)
            .executeTakeFirst()
            .then((r) => r?.id ?? null),
        })
        .execute();

      // A brand-new team sees every area and iteration by default,
      // so it behaves exactly like the project until configured otherwise.
      const areas = await trx
        .selectFrom('areas')
        .where('project_id', '=', projectId)
        .select('id')
        .execute();
      if (areas.length > 0) {
        await trx
          .insertInto('team_areas')
          .values(areas.map((a) => ({ team_id: team.id, area_id: a.id })))
          .execute();
      }
      const iterations = await trx
        .selectFrom('iterations')
        .where('project_id', '=', projectId)
        .select('id')
        .execute();
      if (iterations.length > 0) {
        await trx
          .insertInto('team_iterations')
          .values(iterations.map((i) => ({ team_id: team.id, iteration_id: i.id })))
          .execute();
      }

      return team;
    });
  }

  async update(teamId: string, name: string | undefined, description: string | null | undefined) {
    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    return await db
      .updateTable('teams')
      .set(updateData)
      .where('id', '=', teamId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async remove(teamId: string) {
    await db.deleteFrom('teams').where('id', '=', teamId).execute();
  }

  async addMember(teamId: string, userId: string, role: TeamRole) {
    return await db
      .insertInto('team_members')
      .values({ team_id: teamId, user_id: userId, role })
      .onConflict((oc) => oc.columns(['team_id', 'user_id']).doUpdateSet({ role }))
      .returningAll()
      .executeTakeFirst();
  }

  async updateMemberRole(teamId: string, userId: string, role: TeamRole) {
    return await db
      .updateTable('team_members')
      .set({ role })
      .where('team_id', '=', teamId)
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();
  }

  async removeMember(teamId: string, userId: string) {
    await db
      .deleteFrom('team_members')
      .where('team_id', '=', teamId)
      .where('user_id', '=', userId)
      .execute();
  }

  async countAdmins(teamId: string): Promise<number> {
    const row = await db
      .selectFrom('team_members')
      .where('team_id', '=', teamId)
      .where('role', '=', 'ADMIN')
      .select(sql<number>`count(*)::int`.as('count'))
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  async getMembers(teamId: string): Promise<TeamMemberRow[]> {
    const rows = await db
      .selectFrom('team_members')
      .innerJoin('users', 'users.id', 'team_members.user_id')
      .where('team_members.team_id', '=', teamId)
      .select([
        'team_members.user_id as userId',
        'users.name',
        'users.email',
        'users.avatar_url as avatarUrl',
        'team_members.role',
        'team_members.created_at as createdAt',
      ])
      .orderBy('team_members.created_at', 'asc')
      .execute();

    return rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      email: r.email,
      avatarUrl: r.avatarUrl,
      role: r.role as TeamRole,
      createdAt: r.createdAt,
    }));
  }

  async isProjectMember(projectId: string, userId: string): Promise<boolean> {
    const project = await db
      .selectFrom('projects')
      .where('id', '=', projectId)
      .select(['created_by'])
      .executeTakeFirst();
    if (project?.created_by === userId) return true;
    const row = await db
      .selectFrom('project_members')
      .where('project_id', '=', projectId)
      .where('user_id', '=', userId)
      .select('id')
      .executeTakeFirst();
    return !!row;
  }

  async getSettings(teamId: string): Promise<TeamSettings> {
    const config = await db
      .selectFrom('team_configurations')
      .where('team_id', '=', teamId)
      .selectAll()
      .executeTakeFirst();
    const [iterations, areas] = await Promise.all([
      db
        .selectFrom('team_iterations')
        .where('team_id', '=', teamId)
        .select('iteration_id')
        .execute(),
      db.selectFrom('team_areas').where('team_id', '=', teamId).select('area_id').execute(),
    ]);

    return {
      boardConfig: (config?.board_config as Record<string, unknown>) ?? {},
      backlogConfig: (config?.backlog_config as Record<string, unknown>) ?? {},
      defaultIterationId: config?.default_iteration_id ?? null,
      defaultAreaId: config?.default_area_id ?? null,
      iterations: iterations.map((i) => i.iteration_id),
      areas: areas.map((a) => a.area_id),
    };
  }

  async updateSettings(
    teamId: string,
    settings: {
      boardConfig?: Record<string, unknown>;
      backlogConfig?: Record<string, unknown>;
      defaultIterationId?: string | null;
      defaultAreaId?: string | null;
      iterationIds?: string[];
      areaIds?: string[];
    },
  ) {
    await db.transaction().execute(async (trx) => {
      const updateData: Record<string, unknown> = { updated_at: new Date() };
      if (settings.boardConfig !== undefined) updateData.board_config = settings.boardConfig;
      if (settings.backlogConfig !== undefined) updateData.backlog_config = settings.backlogConfig;
      if (settings.defaultIterationId !== undefined)
        updateData.default_iteration_id = settings.defaultIterationId;
      if (settings.defaultAreaId !== undefined)
        updateData.default_area_id = settings.defaultAreaId;

      await trx
        .updateTable('team_configurations')
        .set(updateData)
        .where('team_id', '=', teamId)
        .execute();

      if (settings.iterationIds !== undefined) {
        await trx.deleteFrom('team_iterations').where('team_id', '=', teamId).execute();
        if (settings.iterationIds.length > 0) {
          await trx
            .insertInto('team_iterations')
            .values(settings.iterationIds.map((id) => ({ team_id: teamId, iteration_id: id })))
            .execute();
        }
      }

      if (settings.areaIds !== undefined) {
        await trx.deleteFrom('team_areas').where('team_id', '=', teamId).execute();
        if (settings.areaIds.length > 0) {
          await trx
            .insertInto('team_areas')
            .values(settings.areaIds.map((id) => ({ team_id: teamId, area_id: id })))
            .execute();
        }
      }
    });
  }

  async getIterationProject(iterationId: string): Promise<string | null> {
    const row = await db
      .selectFrom('iterations')
      .where('id', '=', iterationId)
      .select('project_id')
      .executeTakeFirst();
    return row?.project_id ?? null;
  }

  async getAreaProject(areaId: string): Promise<string | null> {
    const row = await db
      .selectFrom('areas')
      .where('id', '=', areaId)
      .select('project_id')
      .executeTakeFirst();
    return row?.project_id ?? null;
  }

  async getTeamScope(teamId: string): Promise<{ areaIds: string[]; iterationIds: string[] }> {
    const [areas, iterations] = await Promise.all([
      db
        .selectFrom('team_areas')
        .where('team_id', '=', teamId)
        .select('area_id')
        .execute()
        .then((rows) => rows.map((r) => r.area_id)),
      db
        .selectFrom('team_iterations')
        .where('team_id', '=', teamId)
        .select('iteration_id')
        .execute()
        .then((rows) => rows.map((r) => r.iteration_id)),
    ]);
    return { areaIds: areas, iterationIds: iterations };
  }

  async countTeamAreaItems(projectId: string, teamId: string, itemIds: string[]): Promise<number> {
    if (itemIds.length === 0) return 0;
    const row = await db
      .selectFrom('work_items as wi')
      .innerJoin('team_areas as ta', 'ta.area_id', 'wi.area_id')
      .where('wi.project_id', '=', projectId)
      .where('ta.team_id', '=', teamId)
      .where('wi.id', 'in', itemIds)
      .select(sql<number>`count(distinct wi.id)::int`.as('count'))
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }
}