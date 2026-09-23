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
} from './dto/analytics.dto.js';

/**
 * Analytics data access.
 *
 * History-driven metrics need more than the current work-item rows: they need
 * the iteration calendar, the workflow states (for category / done semantics)
 * and the immutable event log the metric can be replayed from. Loading is
 * scoped to exactly the items a metric needs so calculations stay efficient:
 *
 *  - Burndown loads items that EVER belonged to the iteration (current
 *    assignment OR an ITERATION_CHANGED event touching it).
 *  - Range metrics (velocity / CFD / cycle / lead) load items whose lifecycle
 *    overlaps the requested window.
 */

export interface AnalyticsTeamScope {
  areaIds: string[];
  iterationIds: string[];
}

export interface RangeDatasetOptions {
  from: Date;
  to: Date;
  type?: string | null;
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
  points: number | null;
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
    points: row.points === null || row.points === undefined ? null : Number(row.points),
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
   * Loads the dataset for one iteration: the iteration row, workflow states,
   * every item that EVER belonged to the iteration (current assignment or a
   * historical ITERATION_CHANGED event), and their full event logs.
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
        .selectFrom('work_items')
        .where('project_id', '=', projectId)
        .where((eb) =>
          eb.or([
            eb('iteration_id', '=', iterationId),
            eb(
              'id',
              'in',
              db
                .selectFrom('work_item_history as h')
                .innerJoin('work_items as w', 'w.id', 'h.work_item_id')
                .where('w.project_id', '=', projectId)
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
          'id',
          'project_id',
          'seq_no',
          'iteration_id',
          'area_id',
          'type',
          'title',
          'state',
          'points',
          'created_at',
          'completed_at',
          'closed_at',
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

    const history = await this.loadHistoryForItems(itemsFiltered.map((i) => i.id));

    return { iterations, states, items: itemsFiltered, history };
  }

  /**
   * Loads the dataset for a date-range metric: every item whose lifecycle
   * overlaps [from, to] plus their event logs.
   */
  async loadRangeDataset(
    projectId: string,
    opts: RangeDatasetOptions,
  ): Promise<AnalyticsDataset> {
    const [iterations, states, items] = await Promise.all([
      this.loadIterations(projectId),
      this.loadStates(projectId),
      db
        .selectFrom('work_items')
        .where('project_id', '=', projectId)
        .where('created_at', '<=', opts.to)
        .where((eb) =>
          eb.or([eb('completed_at', 'is', null), eb('completed_at', '>=', opts.from)]),
        )
        .$call((q) => (opts.type ? q.where('type', '=', opts.type as AnalyticsWorkItem['type']) : q))
        .$call((q) => this.applyTeamScope(q, opts.teamScope))
        .select([
          'id',
          'project_id',
          'seq_no',
          'iteration_id',
          'area_id',
          'type',
          'title',
          'state',
          'points',
          'created_at',
          'completed_at',
          'closed_at',
        ])
        .execute()
        .then((rows) => rows.map(mapWorkItem)),
    ]);

    const history = await this.loadHistoryForItems(items.map((i) => i.id));

    return { iterations, states, items, history };
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
        eb('area_id', 'in', areaIds),
        eb.or([eb('iteration_id', 'is', null), eb('iteration_id', 'in', iterationIds)]),
      ]),
    ) as T;
  }

  // ─── Snapshot persistence ─────────────────────────────────────────────────

  scopeKey(scope: Record<string, unknown>): string {
    return JSON.stringify(Object.entries(scope).sort(([a], [b]) => a.localeCompare(b)));
  }

  async upsertSnapshot(
    projectId: string,
    kind: AnalyticsSnapshotKind,
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
    kind: AnalyticsSnapshotKind,
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
    kind?: AnalyticsSnapshotKind,
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
      kind: r.kind as AnalyticsSnapshotKind,
      scope: (r.scope as Record<string, unknown>) ?? {},
      itemCount: r.item_count,
      computedAt: toDate(r.computed_at).toISOString(),
      jobId: r.job_id,
    }));
  }
}