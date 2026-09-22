import { Injectable, BadRequestException } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { sql } from 'kysely';

export interface DeliveryPlanRow {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  /** Total number of teams configured on the plan. */
  teamCount: number;
  /** Number of plan teams the requesting user is a member of. */
  userTeamCount: number;
}

export interface PlanTeamRow {
  id: string;
  name: string;
  description: string | null;
  areaIds: string[];
  iterationIds: string[];
  memberCount: number;
}

export interface TimelineTeam {
  id: string;
  name: string;
  areaIds: string[];
  iterationIds: string[];
}

export interface TimelineIteration {
  id: string;
  projectId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  state: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
}

export interface TimelineWorkItem {
  id: string;
  key: string;
  projectId: string;
  iterationId: string | null;
  areaId: string;
  seqNo: number;
  parentId: string | null;
  type: string;
  title: string;
  state: string;
  priority: string;
  points: number | null;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedToAvatar: string | null;
  startDate: Date | null;
  targetDate: Date | null;
  completedAt: Date | null;
  isDone: boolean;
  backlogRank: number;
}

export interface TimelineDependency {
  id: string;
  sourceWorkItemId: string;
  targetWorkItemId: string;
  linkType: 'DEPENDS_ON' | 'RELATED';
}

export interface DeliveryPlanTimeline {
  teams: TimelineTeam[];
  iterations: TimelineIteration[];
  workItems: TimelineWorkItem[];
  dependencies: TimelineDependency[];
  totalWorkItems: number;
  /** Plan teams hidden from the requesting user (no team membership). */
  hiddenTeamCount: number;
  limit: number;
  offset: number;
}

export interface WorkItemLinkRow {
  id: string;
  projectId: string;
  sourceWorkItemId: string;
  targetWorkItemId: string;
  linkType: 'DEPENDS_ON' | 'RELATED';
  createdBy: string;
  createdAt: Date;
  sourceKey: string;
  targetKey: string;
}

export interface DependencyEdge {
  sourceWorkItemId: string;
  targetWorkItemId: string;
}

export interface TimelineOptions {
  projectId: string;
  planId: string;
  userId: string;
  teamId?: string;
  iterationId?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class DeliveryPlansRepository {
  // ─── Plans CRUD ─────────────────────────────────────────────────────────────

  async listByProject(projectId: string, userId: string): Promise<DeliveryPlanRow[]> {
    const rows = await sql<any>`
      SELECT
        dp.*,
        (SELECT COUNT(*)::int FROM delivery_plan_teams dptq WHERE dptq.plan_id = dp.id) AS team_count,
        (SELECT COUNT(*)::int
           FROM delivery_plan_teams dptq
           JOIN team_members tmq ON tmq.team_id = dptq.team_id
          WHERE dptq.plan_id = dp.id AND tmq.user_id = ${userId}) AS user_team_count
      FROM delivery_plans dp
      WHERE dp.project_id = ${projectId}
      ORDER BY dp.created_at ASC, dp.name ASC
    `.execute(db);

    return rows.rows.map((r: any) => ({
      id: r.id,
      projectId: r.project_id,
      name: r.name,
      description: r.description,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      teamCount: Number(r.team_count ?? 0),
      userTeamCount: Number(r.user_team_count ?? 0),
    }));
  }

  async getById(projectId: string, planId: string): Promise<DeliveryPlanRow | null> {
    const row = await db
      .selectFrom('delivery_plans')
      .selectAll()
      .where('id', '=', planId)
      .where('project_id', '=', projectId)
      .executeTakeFirst();
    if (!row) return null;

    const [teamCount, userTeamCount] = await Promise.all([
      db
        .selectFrom('delivery_plan_teams')
        .where('plan_id', '=', planId)
        .select(sql<number>`count(*)::int`.as('count'))
        .executeTakeFirst(),
      db
        .selectFrom('delivery_plan_teams as dpt')
        .innerJoin('team_members as tm', 'tm.team_id', 'dpt.team_id')
        .where('dpt.plan_id', '=', planId)
        .select(sql<number>`count(distinct dpt.team_id)::int`.as('count'))
        .executeTakeFirst(),
    ]);

    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      teamCount: Number(teamCount?.count ?? 0),
      userTeamCount: Number(userTeamCount?.count ?? 0),
    };
  }

  async create(
    projectId: string,
    userId: string,
    data: { name: string; description: string | null; teamIds: string[] },
  ) {
    return db.transaction().execute(async (trx) => {
      const plan = await trx
        .insertInto('delivery_plans')
        .values({
          project_id: projectId,
          name: data.name,
          description: data.description,
          created_by: userId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      if (data.teamIds.length > 0) {
        await trx
          .insertInto('delivery_plan_teams')
          .values(data.teamIds.map((teamId) => ({ plan_id: plan.id, team_id: teamId })))
          .execute();
      }

      return plan;
    });
  }

  async update(
    planId: string,
    userId: string,
    data: { name?: string; description?: string | null },
  ): Promise<DeliveryPlanRow | null> {
    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    const row = await db
      .updateTable('delivery_plans')
      .set(updateData)
      .where('id', '=', planId)
      .returningAll()
      .executeTakeFirst();
    if (!row) return null;

    const [teamCount, userTeamCount] = await Promise.all([
      db
        .selectFrom('delivery_plan_teams')
        .where('plan_id', '=', planId)
        .select(sql<number>`count(*)::int`.as('count'))
        .executeTakeFirst(),
      db
        .selectFrom('delivery_plan_teams as dpt')
        .innerJoin('team_members as tm', 'tm.team_id', 'dpt.team_id')
        .where('dpt.plan_id', '=', planId)
        .where('tm.user_id', '=', userId)
        .select(sql<number>`count(distinct dpt.team_id)::int`.as('count'))
        .executeTakeFirst(),
    ]);

    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      teamCount: Number(teamCount?.count ?? 0),
      userTeamCount: Number(userTeamCount?.count ?? 0),
    };
  }

  async remove(planId: string) {
    await db.deleteFrom('delivery_plans').where('id', '=', planId).execute();
  }

  /**
   * Replaces the plan's team set. Returns the number of teams now on the plan.
   */
  async replaceTeams(planId: string, teamIds: string[]): Promise<number> {
    return db.transaction().execute(async (trx) => {
      await trx.deleteFrom('delivery_plan_teams').where('plan_id', '=', planId).execute();
      if (teamIds.length > 0) {
        await trx
          .insertInto('delivery_plan_teams')
          .values(teamIds.map((teamId) => ({ plan_id: planId, team_id: teamId })))
          .execute();
      }
      const row = await trx
        .selectFrom('delivery_plan_teams')
        .where('plan_id', '=', planId)
        .select(sql<number>`count(*)::int`.as('count'))
        .executeTakeFirst();
      return Number(row?.count ?? 0);
    });
  }

  /**
   * Validates that `teamIds` belong to `projectId`. Returns the valid ids
   * (deduplicated, preserving order) so callers never trust client data.
   */
  async validateTeamsInProject(projectId: string, teamIds: string[]): Promise<string[]> {
    if (teamIds.length === 0) return [];
    const rows = await db
      .selectFrom('teams')
      .where('project_id', '=', projectId)
      .where('id', 'in', teamIds)
      .select('id')
      .execute();
    return rows.map((r) => r.id);
  }

  /** Returns the plan's teams (all of them, no user filtering) with scopes. */
  async getPlanTeams(planId: string): Promise<PlanTeamRow[]> {
    const rows = await sql<any>`
      WITH plan_teams AS (
        SELECT t.id AS team_id, t.name AS team_name, t.description, t.project_id
        FROM delivery_plan_teams dpt
        JOIN teams t ON t.id = dpt.team_id
        WHERE dpt.plan_id = ${planId}
      ),
      scope AS (
        SELECT pt.team_id, pt.team_name, pt.description, ta.area_id, ti.iteration_id
        FROM plan_teams pt
        LEFT JOIN team_areas ta ON ta.team_id = pt.team_id
        LEFT JOIN team_iterations ti ON ti.team_id = pt.team_id
      )
      SELECT
        team_id,
        team_name,
        MAX(description) AS description,
        COALESCE(array_agg(DISTINCT area_id)     FILTER (WHERE area_id IS NOT NULL), '{}') AS area_ids,
        COALESCE(array_agg(DISTINCT iteration_id) FILTER (WHERE iteration_id IS NOT NULL), '{}') AS iteration_ids,
        (SELECT COUNT(*)::int FROM team_members tm WHERE tm.team_id = scope.team_id) AS member_count
      FROM scope
      GROUP BY team_id, team_name
      ORDER BY team_name ASC
    `.execute(db);

    return rows.rows.map((r: any) => ({
      id: r.team_id,
      name: r.team_name,
      description: r.description ?? null,
      areaIds: Array.isArray(r.area_ids) ? r.area_ids : [],
      iterationIds: Array.isArray(r.iteration_ids) ? r.iteration_ids : [],
      memberCount: Number(r.member_count ?? 0),
    }));
  }

  /** Teams of the project the user belongs to. */
  async getUserTeamIds(projectId: string, userId: string): Promise<string[]> {
    const rows = await db
      .selectFrom('team_members as tm')
      .innerJoin('teams as t', 't.id', 'tm.team_id')
      .where('t.project_id', '=', projectId)
      .where('tm.user_id', '=', userId)
      .select('tm.team_id')
      .execute();
    return rows.map((r) => r.team_id);
  }

  // ─── Timeline ───────────────────────────────────────────────────────────────

  /**
   * Loads a delivery plan timeline.
   *
   * Scoping (in order):
   *  1. Organization / project: everything is hard-filtered by `projectId`.
   *  2. Plan: only the plan's teams participate (`delivery_plan_teams`).
   *  3. Team: only teams the requesting user is a member of (`team_members`).
   *  4. Work items: restricted to the included teams' AREA scopes and to
   *     items assigned to the teams' ITERATION scopes or carrying explicit
   *     start/target dates. Pageable via limit/offset so callers never load
   *     the full project's work items.
   */
  async getTimeline(opts: TimelineOptions): Promise<DeliveryPlanTimeline> {
    const { projectId, planId, userId, teamId, iterationId } = opts;
    const limit = Math.min(opts.limit ?? 300, 500);
    const offset = Math.max(opts.offset ?? 0, 0);

    const scoped = await this.getScopedPlanTeams(planId, projectId, userId);
    let teams = scoped.teams;
    if (teamId) teams = teams.filter((t) => t.id === teamId);

    const areaIds = [...new Set(teams.flatMap((t) => t.areaIds))];
    const iterationIds = [...new Set(teams.flatMap((t) => t.iterationIds))];

    // Iterations visible on the plan (union of the teams' scopes, ordered).
    let iterations: TimelineIteration[] = [];
    if (iterationIds.length > 0) {
      iterations = await this.loadIterations(iterationIds);
      if (iterationId) iterations = iterations.filter((i) => i.id === iterationId);
    }

    const filteredIterationIds = iterationId ? [iterationId] : iterationIds;

    // Work items (pageable — never load the whole project).
    const workItems = await this.loadTimelineWorkItems({
      projectId,
      areaIds,
      iterationIds: filteredIterationIds,
      limit,
      offset,
    });

    const totalWorkItems =
      areaIds.length === 0
        ? 0
        : await this.countTimelineWorkItems({ projectId, areaIds, iterationIds: filteredIterationIds });

    // Dependencies between the loaded work items (kept small on purpose).
    const dependencies = await this.loadDependenciesForItems(
      projectId,
      workItems.map((w) => w.id),
    );

    return {
      teams,
      iterations,
      workItems,
      dependencies,
      totalWorkItems,
      hiddenTeamCount: scoped.hiddenTeamCount,
      limit,
      offset,
    };
  }

  /**
   * Plan teams the user can see, each with its area/iteration scopes, plus a
   * count of plan teams hidden from the user.
   */
  private async getScopedPlanTeams(
    planId: string,
    projectId: string,
    userId: string,
  ): Promise<{ teams: TimelineTeam[]; hiddenTeamCount: number }> {
    const rows = await sql<any>`
      WITH plan_teams AS (
        SELECT t.id AS team_id, t.name AS team_name, t.project_id
        FROM delivery_plan_teams dpt
        JOIN teams t ON t.id = dpt.team_id
        WHERE dpt.plan_id = ${planId} AND t.project_id = ${projectId}
      ),
      member_teams AS (
        SELECT pt.*
        FROM plan_teams pt
        JOIN team_members tm ON tm.team_id = pt.team_id AND tm.user_id = ${userId}
      ),
      scope AS (
        SELECT mt.team_id, mt.team_name, ta.area_id, ti.iteration_id
        FROM member_teams mt
        LEFT JOIN team_areas ta ON ta.team_id = mt.team_id
        LEFT JOIN team_iterations ti ON ti.team_id = mt.team_id
      )
      SELECT
        team_id,
        team_name,
        COALESCE(array_agg(DISTINCT area_id)      FILTER (WHERE area_id IS NOT NULL), '{}') AS area_ids,
        COALESCE(array_agg(DISTINCT iteration_id) FILTER (WHERE iteration_id IS NOT NULL), '{}') AS iteration_ids
      FROM scope
      GROUP BY team_id, team_name
      ORDER BY team_name ASC, team_id ASC
    `.execute(db);

    const teams: TimelineTeam[] = rows.rows.map((r: any) => ({
      id: r.team_id,
      name: r.team_name,
      areaIds: Array.isArray(r.area_ids) ? r.area_ids : [],
      iterationIds: Array.isArray(r.iteration_ids) ? r.iteration_ids : [],
    }));

    const countRow = await db
      .selectFrom('delivery_plan_teams as dpt')
      .innerJoin('teams as t', 't.id', 'dpt.team_id')
      .where('dpt.plan_id', '=', planId)
      .where('t.project_id', '=', projectId)
      .select(sql<number>`count(*)::int`.as('count'))
      .executeTakeFirst();

    return {
      teams,
      hiddenTeamCount: Math.max(Number(countRow?.count ?? 0) - teams.length, 0),
    };
  }

  private async loadIterations(iterationIds: string[]): Promise<TimelineIteration[]> {
    if (iterationIds.length === 0) return [];
    const rows = await db
      .selectFrom('iterations')
      .select(['id', 'project_id', 'name', 'start_date', 'end_date', 'state'])
      .where('id', 'in', iterationIds)
      .orderBy('start_date', 'asc')
      .orderBy('name', 'asc')
      .execute();
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      name: r.name,
      startDate: r.start_date,
      endDate: r.end_date,
      state: r.state,
    }));
  }

  private async loadTimelineWorkItems(opts: {
    projectId: string;
    areaIds: string[];
    iterationIds: string[];
    limit: number;
    offset: number;
  }): Promise<TimelineWorkItem[]> {
    if (opts.areaIds.length === 0) return [];
    const rows = await sql<any>`
      SELECT
        wi.id,
        wi.project_id,
        wi.iteration_id,
        wi.area_id,
        wi.seq_no,
        wi.parent_id,
        wi.type,
        wi.title,
        wi.state,
        wi.priority,
        wi.points,
        wi.assigned_to,
        wi.start_date,
        wi.target_date,
        wi.completed_at,
        wi.backlog_rank,
        u.name      AS assigned_to_name,
        u.avatar_url AS assigned_to_avatar,
        COALESCE(wis.is_done, false) AS is_done,
        p.key       AS project_key
      FROM work_items wi
      LEFT JOIN users u ON u.id = wi.assigned_to
      LEFT JOIN work_item_states wis
        ON wis.key = wi.state AND wis.project_id = wi.project_id
      JOIN projects p ON p.id = wi.project_id
      WHERE wi.project_id = ${opts.projectId}
        AND wi.area_id = ANY(${opts.areaIds})
        AND (
          wi.iteration_id = ANY(${opts.iterationIds})
          OR wi.start_date IS NOT NULL
          OR wi.target_date IS NOT NULL
        )
      ORDER BY wi.start_date ASC NULLS LAST, wi.backlog_rank ASC, wi.seq_no ASC
      LIMIT ${opts.limit}
      OFFSET ${opts.offset}
    `.execute(db);

    return rows.rows.map((r: any) => ({
      id: r.id,
      key: `${r.project_key}-${r.seq_no}`,
      projectId: r.project_id,
      iterationId: r.iteration_id,
      areaId: r.area_id,
      seqNo: r.seq_no,
      parentId: r.parent_id,
      type: r.type,
      title: r.title,
      state: r.state,
      priority: r.priority,
      points: r.points == null ? null : Number(r.points),
      assignedTo: r.assigned_to,
      assignedToName: r.assigned_to_name,
      assignedToAvatar: r.assigned_to_avatar,
      startDate: r.start_date,
      targetDate: r.target_date,
      completedAt: r.completed_at,
      isDone: Boolean(r.is_done),
      backlogRank: Number(r.backlog_rank),
    }));
  }

  private async countTimelineWorkItems(opts: {
    projectId: string;
    areaIds: string[];
    iterationIds: string[];
  }): Promise<number> {
    const row = await sql<{ count: number }>`
      SELECT COUNT(*)::int AS count
      FROM work_items wi
      WHERE wi.project_id = ${opts.projectId}
        AND wi.area_id = ANY(${opts.areaIds})
        AND (
          wi.iteration_id = ANY(${opts.iterationIds})
          OR wi.start_date IS NOT NULL
          OR wi.target_date IS NOT NULL
        )
    `.execute(db);
    return Number(row.rows[0]?.count ?? 0);
  }

  private async loadDependenciesForItems(
    projectId: string,
    itemIds: string[],
  ): Promise<TimelineDependency[]> {
    if (itemIds.length === 0) return [];
    const rows = await db
      .selectFrom('work_item_links')
      .select(['id', 'source_work_item_id', 'target_work_item_id', 'link_type'])
      .where('project_id', '=', projectId)
      .where((eb) =>
        eb.or([
          eb('source_work_item_id', 'in', itemIds),
          eb('target_work_item_id', 'in', itemIds),
        ]),
      )
      .execute();
    return rows.map((r) => ({
      id: r.id,
      sourceWorkItemId: r.source_work_item_id,
      targetWorkItemId: r.target_work_item_id,
      linkType: r.link_type as 'DEPENDS_ON' | 'RELATED',
    }));
  }

  // ─── Work item links (dependencies) ─────────────────────────────────────────

  async getItemLinks(projectId: string, workItemId: string): Promise<WorkItemLinkRow[]> {
    const rows = await sql<any>`
      SELECT
        l.id,
        l.project_id,
        l.source_work_item_id,
        l.target_work_item_id,
        l.link_type,
        l.created_by,
        l.created_at,
        s.seq_no AS source_seq,
        t.seq_no AS target_seq,
        p.key AS project_key
      FROM work_item_links l
      JOIN work_items s ON s.id = l.source_work_item_id
      JOIN work_items t ON t.id = l.target_work_item_id
      JOIN projects p ON p.id = l.project_id
      WHERE l.project_id = ${projectId}
        AND (l.source_work_item_id = ${workItemId} OR l.target_work_item_id = ${workItemId})
      ORDER BY l.created_at ASC
    `.execute(db);

    return rows.rows.map((r: any) => ({
      id: r.id,
      projectId: r.project_id,
      sourceWorkItemId: r.source_work_item_id,
      targetWorkItemId: r.target_work_item_id,
      linkType: r.link_type as 'DEPENDS_ON' | 'RELATED',
      createdBy: r.created_by,
      createdAt: r.created_at,
      sourceKey: `${r.project_key}-${r.source_seq}`,
      targetKey: `${r.project_key}-${r.target_seq}`,
    }));
  }

  async createLink(
    projectId: string,
    sourceWorkItemId: string,
    targetWorkItemId: string,
    linkType: 'DEPENDS_ON' | 'RELATED',
    createdBy: string,
  ): Promise<WorkItemLinkRow | null> {
    let row: { id: string } | undefined;
    try {
      row = await db
        .insertInto('work_item_links')
        .values({
          project_id: projectId,
          source_work_item_id: sourceWorkItemId,
          target_work_item_id: targetWorkItemId,
          link_type: linkType,
          created_by: createdBy,
        })
        .returning(['id'])
        .executeTakeFirst();
    } catch (err: any) {
      // unique violation on (source, target, type)
      if (err?.code === '23505') {
        throw new BadRequestException('This dependency already exists');
      }
      throw err;
    }

    if (!row) return null;

    const links = await this.getItemLinks(projectId, sourceWorkItemId);
    return links.find((l) => l.id === row.id) ?? null;
  }

  async removeLink(projectId: string, sourceWorkItemId: string, targetWorkItemId: string) {
    const result = await db
      .deleteFrom('work_item_links')
      .where('project_id', '=', projectId)
      .where('source_work_item_id', '=', sourceWorkItemId)
      .where('target_work_item_id', '=', targetWorkItemId)
      .execute();
    return Number(result[0]?.numDeletedRows ?? 0) > 0;
  }

  /**
   * Returns every DEPENDS_ON edge in the project — used for cycle detection.
   * Direction is "source depends on target" (source → target).
   */
  async getDependencyEdges(projectId: string): Promise<DependencyEdge[]> {
    const rows = await db
      .selectFrom('work_item_links')
      .select(['source_work_item_id', 'target_work_item_id'])
      .where('project_id', '=', projectId)
      .where('link_type', '=', 'DEPENDS_ON')
      .execute();
    return rows.map((r) => ({
      sourceWorkItemId: r.source_work_item_id,
      targetWorkItemId: r.target_work_item_id,
    }));
  }
}