import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { db } from '../../db/kysely.js';
import {
  AnalyticsDataset,
  AnalyticsHistoryEvent,
  AnalyticsIteration,
  AnalyticsSnapshotInfoDto,
  AnalyticsStateDef,
  AnalyticsWorkItem,
  AnalyticsSnapshotKind,
  SavedReportDto,
  CreateSavedReportDto,
  BlockedWorkItemDto,
} from './dto/analytics.dto.js';

export interface AnalyticsTeamScope {
  areaIds: string[];
  iterationIds: string[];
}

export interface RangeDatasetOptions {
  from: Date;
  to: Date;
  type?: string | null;
  types?: string[] | null;
  states?: string[] | null;
  priorities?: string[] | null;
  assignedTo?: string[] | null;
  areaId?: string | null;
  iterationId?: string | null;
  teamScope?: AnalyticsTeamScope | null;
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
}

function mapState(row: {
  key: string;
  name: string;
  color: string;
  sort_order: number;
  category: AnalyticsStateDef['category'];
  is_done: boolean;
  is_default: boolean;
}): AnalyticsStateDef {
  return {
    key: row.key,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    category: row.category,
    isDone: row.is_done,
    isDefault: row.is_default,
  };
}

function mapIteration(row: {
  id: string;
  project_id: string;
  name: string;
  start_date: Date;
  end_date: Date;
  state: AnalyticsIteration['state'];
}): AnalyticsIteration {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    startDate: toDate(row.start_date),
    endDate: toDate(row.end_date),
    state: row.state,
  };
}

function mapWorkItem(row: {
  id: string;
  project_id: string;
  seq_no: number;
  iteration_id: string | null;
  area_id: string;
  type: AnalyticsWorkItem['type'];
  title: string;
  state: string;
  priority?: AnalyticsWorkItem['priority'];
  points: number | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  target_date?: Date | null;
  severity?: AnalyticsWorkItem['severity'];
  created_at: Date;
  completed_at: Date | null;
  closed_at: Date | null;
}): AnalyticsWorkItem {
  return {
    id: row.id,
    projectId: row.project_id,
    seqNo: row.seq_no,
    iterationId: row.iteration_id,
    areaId: row.area_id,
    type: row.type,
    title: row.title,
    state: row.state,
    priority: row.priority ?? 'MEDIUM',
    points: row.points === null || row.points === undefined ? null : Number(row.points),
    assignedTo: row.assigned_to ?? null,
    assignedToName: row.assigned_to_name ?? null,
    targetDate: row.target_date ? toDate(row.target_date) : null,
    severity: row.severity ?? null,
    createdAt: toDate(row.created_at),
    completedAt: row.completed_at ? toDate(row.completed_at) : null,
    closedAt: row.closed_at ? toDate(row.closed_at) : null,
    deletedAt: null,
  };
}

function mapHistory(row: {
  id: string;
  work_item_id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: Date;
  inserted_at: Date | null;
}): AnalyticsHistoryEvent {
  return {
    id: row.id,
    workItemId: row.work_item_id,
    action: row.action,
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    createdAt: toDate(row.created_at),
    insertedAt: toDate(row.inserted_at ?? row.created_at),
  };
}

@Injectable()
export class AnalyticsRepository {
  async loadStates(projectId: string): Promise<AnalyticsStateDef[]> {
    const rows = await db
      .selectFrom('work_item_states')
      .where('project_id', '=', projectId)
      .select(['key', 'name', 'color', 'sort_order', 'category', 'is_done', 'is_default'])
      .orderBy('sort_order', 'asc')
      .execute();
    return rows.map(mapState);
  }

  async loadIterations(projectId: string): Promise<AnalyticsIteration[]> {
    const rows = await db
      .selectFrom('iterations')
      .where('project_id', '=', projectId)
      .select(['id', 'project_id', 'name', 'start_date', 'end_date', 'state'])
      .orderBy('start_date', 'asc')
      .execute();
    return rows.map(mapIteration);
  }

  async loadIteration(
    projectId: string,
    iterationId: string,
  ): Promise<AnalyticsIteration | null> {
    const row = await db
      .selectFrom('iterations')
      .where('id', '=', iterationId)
      .where('project_id', '=', projectId)
      .select(['id', 'project_id', 'name', 'start_date', 'end_date', 'state'])
      .executeTakeFirst();
    return row ? mapIteration(row) : null;
  }

  async loadHistoryForItems(itemIds: string[]): Promise<AnalyticsHistoryEvent[]> {
    if (itemIds.length === 0) return [];
    const rows = await db
      .selectFrom('work_item_history')
      .where('work_item_id', 'in', itemIds)
      .select([
        'id',
        'work_item_id',
        'action',
        'field',
        'old_value',
        'new_value',
        'created_at',
        'inserted_at',
      ])
      .orderBy('inserted_at', 'asc')
      .execute();
    return rows.map(mapHistory);
  }

  /**
   * Loads the dataset for one iteration.
   */
  async loadIterationDataset(
    projectId: string,
    iterationId: string,
    teamScope?: AnalyticsTeamScope | null,
  ): Promise<AnalyticsDataset> {
    const [iteration, iterations, states, items] = await Promise.all([
      this.loadIteration(projectId, iterationId),
      this.loadIterations(projectId),
      this.loadStates(projectId),
      db
        .selectFrom('work_items as w')
        .leftJoin('users as u', 'u.id', 'w.assigned_to')
        .where('w.project_id', '=', projectId)
        .where((eb) =>
          eb.or([
            eb('w.iteration_id', '=', iterationId),
            eb(
              'w.id',
              'in',
              db
                .selectFrom('work_item_history as h')
                .innerJoin('work_items as w2', 'w2.id', 'h.work_item_id')
                .where('w2.project_id', '=', projectId)
                .where('h.action', '=', 'ITERATION_CHANGED')
                .where((eb2) =>
                  eb2.or([
                    eb2('h.new_value', '=', iterationId),
                    eb2('h.old_value', '=', iterationId),
                  ]),
                )
                .select('h.work_item_id'),
            ),
          ]),
        )
        .select([
          'w.id',
          'w.project_id',
          'w.seq_no',
          'w.iteration_id',
          'w.area_id',
          'w.type',
          'w.title',
          'w.state',
          'w.priority',
          'w.points',
          'w.assigned_to',
          'u.name as assigned_to_name',
          'w.target_date',
          'w.severity',
          'w.created_at',
          'w.completed_at',
          'w.closed_at',
        ])
        .execute()
        .then((rows) => rows.map(mapWorkItem)),
    ]);

    if (!iteration) {
      return { iterations, states, items: [], history: [] };
    }

    const itemsFiltered: AnalyticsWorkItem[] = teamScope
      ? items.filter(
          (i) =>
            teamScope.areaIds.includes(i.areaId) &&
            (i.iterationId === null || teamScope.iterationIds.includes(i.iterationId)),
        )
      : items;

    const iterationsFiltered = teamScope
      ? iterations.filter((it) => teamScope.iterationIds.includes(it.id))
      : iterations;

    const history = await this.loadHistoryForItems(itemsFiltered.map((i) => i.id));

    return { iterations: iterationsFiltered, states, items: itemsFiltered, history };
  }

  /**
   * Loads the dataset for a date-range metric with flexible filtering.
   */
  async loadRangeDataset(
    projectId: string,
    opts: RangeDatasetOptions,
  ): Promise<AnalyticsDataset> {
    const [iterations, states, items] = await Promise.all([
      this.loadIterations(projectId),
      this.loadStates(projectId),
      db
        .selectFrom('work_items as w')
        .leftJoin('users as u', 'u.id', 'w.assigned_to')
        .where('w.project_id', '=', projectId)
        .where('w.created_at', '<=', opts.to)
        .where((eb) =>
          eb.or([eb('w.completed_at', 'is', null), eb('w.completed_at', '>=', opts.from)]),
        )
        .$call((q) => (opts.type ? q.where('w.type', '=', opts.type as AnalyticsWorkItem['type']) : q))
        .$call((q) => (opts.types && opts.types.length > 0 ? q.where('w.type', 'in', opts.types as AnalyticsWorkItem['type'][]) : q))
        .$call((q) => (opts.states && opts.states.length > 0 ? q.where('w.state', 'in', opts.states) : q))
        .$call((q) => (opts.priorities && opts.priorities.length > 0 ? q.where('w.priority', 'in', opts.priorities as AnalyticsWorkItem['priority'][]) : q))
        .$call((q) => (opts.assignedTo && opts.assignedTo.length > 0 ? q.where('w.assigned_to', 'in', opts.assignedTo) : q))
        .$call((q) => (opts.areaId ? q.where('w.area_id', '=', opts.areaId) : q))
        .$call((q) => (opts.iterationId ? q.where('w.iteration_id', '=', opts.iterationId) : q))
        .$call((q) => this.applyTeamScope(q, opts.teamScope))
        .select([
          'w.id',
          'w.project_id',
          'w.seq_no',
          'w.iteration_id',
          'w.area_id',
          'w.type',
          'w.title',
          'w.state',
          'w.priority',
          'w.points',
          'w.assigned_to',
          'u.name as assigned_to_name',
          'w.target_date',
          'w.severity',
          'w.created_at',
          'w.completed_at',
          'w.closed_at',
        ])
        .execute()
        .then((rows) => rows.map(mapWorkItem)),
    ]);

    const iterationsFiltered = opts.teamScope
      ? iterations.filter((it) => opts.teamScope!.iterationIds.includes(it.id))
      : iterations;

    const history = await this.loadHistoryForItems(items.map((i) => i.id));

    return { iterations: iterationsFiltered, states, items, history };
  }

  private applyTeamScope<T>(query: T, teamScope: AnalyticsTeamScope | null | undefined): T {
    if (!teamScope) return query;
    const areaIds =
      teamScope.areaIds.length > 0 ? teamScope.areaIds : ['00000000-0000-0000-0000-000000000000'];
    const iterationIds =
      teamScope.iterationIds.length > 0
        ? teamScope.iterationIds
        : ['00000000-0000-0000-0000-000000000000'];
    return (query as any).where((eb: any) =>
      eb.and([
        eb('w.area_id', 'in', areaIds),
        eb.or([eb('w.iteration_id', 'is', null), eb('w.iteration_id', 'in', iterationIds)]),
      ]),
    ) as T;
  }

  /**
   * Loads blocked work items for a project (dependency links + critical/urgent blockers).
   */
  async loadBlockedItems(projectId: string, limit = 50): Promise<BlockedWorkItemDto[]> {
    const depRows = await db
      .selectFrom('work_item_links')
      .innerJoin('work_items as source_item', 'source_item.id', 'work_item_links.source_work_item_id')
      .leftJoin('users as source_user', 'source_user.id', 'source_item.assigned_to')
      .innerJoin('work_items as target_item', 'target_item.id', 'work_item_links.target_work_item_id')
      .innerJoin('work_item_states as target_state', (join) =>
        join.onRef('target_state.key', '=', 'target_item.state')
            .onRef('target_state.project_id', '=', 'target_item.project_id')
      )
      .innerJoin('projects as source_proj', 'source_proj.id', 'source_item.project_id')
      .innerJoin('projects as target_proj', 'target_proj.id', 'target_item.project_id')
      .where('work_item_links.link_type', '=', 'DEPENDS_ON')
      .where('target_state.is_done', '=', false)
      .where('work_item_links.project_id', '=', projectId)
      .select([
        'source_item.id as sourceId',
        'source_item.seq_no as sourceSeqNo',
        'source_item.title as sourceTitle',
        'source_item.type as sourceType',
        'source_item.state as sourceState',
        'source_item.priority as sourcePriority',
        'source_item.assigned_to as sourceAssignedTo',
        'source_user.name as sourceAssignedToName',
        'target_item.id as targetId',
        'target_item.seq_no as targetSeqNo',
        'target_proj.key as targetKey',
        'target_item.title as targetTitle',
        'target_item.state as targetState',
      ])
      .limit(limit)
      .execute();

    const items: BlockedWorkItemDto[] = depRows.map((r) => ({
      id: r.sourceId,
      seqNo: r.sourceSeqNo,
      title: r.sourceTitle,
      type: r.sourceType,
      state: r.sourceState,
      priority: r.sourcePriority,
      assignedTo: r.sourceAssignedTo,
      assignedToName: r.sourceAssignedToName,
      reason: `Blocked by ${r.targetKey}-${r.targetSeqNo} (${r.targetTitle})`,
      blockedBy: {
        id: r.targetId,
        seqNo: r.targetSeqNo,
        title: r.targetTitle,
        state: r.targetState,
      },
    }));

    if (items.length < limit) {
      const seenIds = new Set(items.map((i) => i.id));
      const critRows = await db
        .selectFrom('work_items as w')
        .leftJoin('users as u', 'u.id', 'w.assigned_to')
        .innerJoin('work_item_states as s', (join) =>
          join.onRef('s.key', '=', 'w.state').onRef('s.project_id', '=', 'w.project_id')
        )
        .where('w.project_id', '=', projectId)
        .where('s.is_done', '=', false)
        .where((eb) =>
          eb.or([eb('w.priority', '=', 'URGENT'), eb('w.severity', '=', 'CRITICAL')])
        )
        .select([
          'w.id',
          'w.seq_no as seqNo',
          'w.title',
          'w.type',
          'w.state',
          'w.priority',
          'w.assigned_to as assignedTo',
          'u.name as assignedToName',
          'w.severity',
        ])
        .limit((limit - items.length) * 2)
        .execute();

      for (const r of critRows) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          items.push({
            id: r.id,
            seqNo: r.seqNo,
            title: r.title,
            type: r.type,
            state: r.state,
            priority: r.priority,
            assignedTo: r.assignedTo,
            assignedToName: r.assignedToName,
            reason: r.severity === 'CRITICAL' ? 'Critical severity blocker' : 'Urgent priority blocker',
            blockedBy: null,
          });
          if (items.length >= limit) break;
        }
      }
    }

    return items;
  }

  // ─── Saved Reports ────────────────────────────────────────────────────────

  async listSavedReports(projectId: string): Promise<SavedReportDto[]> {
    const rows = await db
      .selectFrom('saved_reports')
      .where('project_id', '=', projectId)
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      createdBy: r.created_by,
      name: r.name,
      description: r.description,
      reportType: r.report_type,
      filters: (r.filters as Record<string, unknown>) ?? {},
      isShared: r.is_shared,
      createdAt: toDate(r.created_at).toISOString(),
      updatedAt: toDate(r.updated_at).toISOString(),
    }));
  }

  async createSavedReport(
    projectId: string,
    userId: string,
    dto: CreateSavedReportDto,
  ): Promise<SavedReportDto> {
    const row = await db
      .insertInto('saved_reports')
      .values({
        project_id: projectId,
        created_by: userId,
        name: dto.name,
        description: dto.description ?? null,
        report_type: dto.reportType,
        filters: dto.filters as any,
        is_shared: dto.isShared,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: row.id,
      projectId: row.project_id,
      createdBy: row.created_by,
      name: row.name,
      description: row.description,
      reportType: row.report_type,
      filters: (row.filters as Record<string, unknown>) ?? {},
      isShared: row.is_shared,
      createdAt: toDate(row.created_at).toISOString(),
      updatedAt: toDate(row.updated_at).toISOString(),
    };
  }

  async deleteSavedReport(projectId: string, reportId: string): Promise<void> {
    await db
      .deleteFrom('saved_reports')
      .where('id', '=', reportId)
      .where('project_id', '=', projectId)
      .execute();
  }

  // ─── Organization Aggregations ───────────────────────────────────────────

  async loadOrgProjects(orgId: string, userId: string): Promise<Array<{ id: string; name: string; key: string }>> {
    // Return projects in org where user is member or creator
    return await db
      .selectFrom('projects as p')
      .leftJoin('project_members as pm', (jb) =>
        jb.onRef('pm.project_id', '=', 'p.id').on('pm.user_id', '=', userId)
      )
      .where('p.organization_id', '=', orgId)
      .where('p.archived', '=', false)
      .where((eb) => eb.or([eb('p.created_by', '=', userId), eb('pm.user_id', '=', userId)]))
      .select(['p.id', 'p.name', 'p.key'])
      .distinct()
      .execute();
  }

  // ─── Snapshot persistence ─────────────────────────────────────────────────

  scopeKey(scope: Record<string, unknown>): string {
    return JSON.stringify(Object.entries(scope).sort(([a], [b]) => a.localeCompare(b)));
  }

  async upsertSnapshot(
    projectId: string,
    kind: AnalyticsSnapshotKind | string,
    scope: Record<string, unknown>,
    data: Record<string, unknown>,
    itemCount: number,
    jobId: string | null,
  ): Promise<void> {
    const key = this.scopeKey(scope);
    await db
      .insertInto('analytics_snapshots')
      .values({
        project_id: projectId,
        kind,
        scope_key: key,
        scope,
        data,
        item_count: itemCount,
        job_id: jobId,
      })
      .onConflict((oc) =>
        oc.columns(['project_id', 'kind', 'scope_key']).doUpdateSet({
          data: sql`excluded.data`,
          item_count: sql`excluded.item_count`,
          job_id: sql`excluded.job_id`,
          computed_at: sql`CURRENT_TIMESTAMP`,
        }),
      )
      .execute();
  }

  async getSnapshot(
    projectId: string,
    kind: AnalyticsSnapshotKind | string,
    scope: Record<string, unknown>,
  ): Promise<{
    data: Record<string, any>;
    itemCount: number;
    computedAt: string;
    jobId: string | null;
  } | null> {
    const row = await db
      .selectFrom('analytics_snapshots')
      .where('project_id', '=', projectId)
      .where('kind', '=', kind)
      .where('scope_key', '=', this.scopeKey(scope))
      .select(['data', 'item_count', 'computed_at', 'job_id'])
      .executeTakeFirst();
    if (!row) return null;
    return {
      data: (row.data as Record<string, any>) ?? {},
      itemCount: row.item_count,
      computedAt: toDate(row.computed_at).toISOString(),
      jobId: row.job_id,
    };
  }

  async listSnapshots(
    projectId: string,
    kind?: string,
  ): Promise<AnalyticsSnapshotInfoDto[]> {
    let query = db
      .selectFrom('analytics_snapshots')
      .where('project_id', '=', projectId)
      .select(['id', 'kind', 'scope', 'item_count', 'computed_at', 'job_id'])
      .orderBy('computed_at', 'desc');
    if (kind) query = query.where('kind', '=', kind);
    const rows = await query.limit(50).execute();
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      scope: (r.scope as Record<string, unknown>) ?? {},
      itemCount: r.item_count,
      computedAt: toDate(r.computed_at).toISOString(),
      jobId: r.job_id,
    }));
  }
}