import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { sql } from 'kysely';
import type { SqlBool } from 'kysely';

const FIELD_COLUMN: Record<string, string> = {
  key: 'seq_no',
  type: 'type',
  title: 'title',
  description: 'description',
  state: 'state',
  priority: 'priority',
  points: 'points',
  severity: 'severity',
  remainingWork: 'remaining_work',
  completedWork: 'completed_work',
  assignedTo: 'assigned_to',
  iterationId: 'iteration_id',
  areaId: 'area_id',
  parentId: 'parent_id',
  createdBy: 'created_by',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  completedAt: 'completed_at',
  startDate: 'start_date',
  targetDate: 'target_date',
};

const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'completedAt', 'startDate', 'targetDate']);
const NUMERIC_FIELDS = new Set(['points', 'key', 'seqNo', 'remainingWork', 'completedWork']);

@Injectable()
export class QueriesRepository {
  async findAllByProject(projectId: string) {
    const rows = await db
      .selectFrom('saved_queries')
      .selectAll()
      .where('project_id', '=', projectId)
      .orderBy('is_shared', 'desc')
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
      .execute();

    return rows.map((r) => this.mapQuery(r));
  }

  async findOne(id: string) {
    const row = await db
      .selectFrom('saved_queries')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;
    return this.mapQuery(row);
  }

  async create(projectId: string, userId: string, data: any) {
    const result = await db
      .insertInto('saved_queries')
      .values({
        project_id: projectId,
        name: data.name,
        description: data.description ?? null,
        is_shared: data.isShared ?? false,
        created_by: userId,
        folder: data.folder ?? null,
        definition: JSON.stringify(data.definition ?? { filters: [] }),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapQuery(result);
  }

  async update(id: string, data: any) {
    const updateData: any = { updated_at: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isShared !== undefined) updateData.is_shared = data.isShared;
    if (data.folder !== undefined) updateData.folder = data.folder;
    if (data.definition !== undefined)
      updateData.definition = JSON.stringify(data.definition);

    const result = await db
      .updateTable('saved_queries')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapQuery(result);
  }

  async remove(id: string) {
    await db.deleteFrom('saved_queries').where('id', '=', id).execute();
  }

  async recordRun(
    projectId: string,
    queryId: string | null,
    userId: string,
    definition: any,
  ) {
    await db
      .insertInto('query_runs')
      .values({
        project_id: projectId,
        query_id: queryId,
        user_id: userId,
        definition: definition ? JSON.stringify(definition) : null,
      })
      .execute();
  }

  async findRecent(projectId: string, userId: string, limit = 8) {
    const rows = await db
      .selectFrom('query_runs')
      .innerJoin('saved_queries', 'saved_queries.id', 'query_runs.query_id')
      .where('query_runs.project_id', '=', projectId)
      .where('query_runs.user_id', '=', userId)
      .select([
        'saved_queries.id',
        'saved_queries.project_id',
        'saved_queries.name',
        'saved_queries.description',
        'saved_queries.is_shared',
        'saved_queries.created_by',
        'saved_queries.folder',
        'saved_queries.definition',
        'saved_queries.sort_order',
        'saved_queries.created_at',
        'saved_queries.updated_at',
        'query_runs.ran_at',
      ])
      .distinctOn(['saved_queries.id'])
      .orderBy('saved_queries.id')
      .orderBy('query_runs.ran_at', 'desc')
      .limit(limit)
      .execute();

    return rows.map((r) => this.mapQuery(r));
  }

  async execute(
    projectId: string,
    definition: any,
    userId: string,
    projectKey: string,
  ) {
    const clauses = Array.isArray(definition?.filters)
      ? definition.filters
      : [];
    const sortBy = definition?.sortBy ?? 'key';
    const sortOrder = definition?.sortOrder === 'desc' ? 'desc' : 'asc';
    const limit =
      definition?.limit && definition.limit > 0
        ? Math.min(definition.limit, 500)
        : 100;

    const sortColumn = FIELD_COLUMN[sortBy] ?? 'seq_no';
    const sortDir = sortOrder === 'desc' ? 'desc' : 'asc';

    let query = db.selectFrom('work_items').where('project_id', '=', projectId);

    if (clauses.length > 0) {
      query = query.where((eb) => {
        const conditions = clauses.map((clause: any) =>
          this.buildClause(eb, clause, userId),
        );
        let expr: any = conditions[0];
        for (let i = 1; i < conditions.length; i++) {
          const logicalOp = clauses[i]?.logicalOperator;
          if (logicalOp === 'OR') {
            expr = eb.or([expr, conditions[i]]);
          } else {
            expr = eb.and([expr, conditions[i]]);
          }
        }
        return expr;
      });
    }

    const rows = await query
      .selectAll()
      .select(() => [
        sql<string[]>`COALESCE(
          (SELECT jsonb_agg(t.name)
           FROM work_item_tags wit
           JOIN tags t ON t.id = wit.tag_id
           WHERE wit.work_item_id = work_items.id),
          '[]'::jsonb
        )`.as('tags'),
      ])
      .orderBy(sortColumn as any, sortDir as 'asc' | 'desc')
      .limit(limit)
      .execute();

    return rows.map((r) => ({
      id: r.id,
      key: `${projectKey}-${r.seq_no}`,
      projectId: r.project_id,
      iterationId: r.iteration_id,
      areaId: r.area_id,
      seqNo: r.seq_no,
      parentId: r.parent_id,
      type: r.type,
      title: r.title,
      description: r.description,
      state: r.state,
      priority: r.priority,
      points: r.points,
      assignedTo: r.assigned_to,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      completedAt: r.completed_at,
      tags: Array.isArray((r as any).tags) ? (r as any).tags : [],
    }));
  }

  private buildClause(eb: any, clause: any, userId: string): any {
    const logicalOperator = clause?.logicalOperator ?? 'AND';

    // Handle nested group AST
    const nestedList = Array.isArray(clause?.clauses)
      ? clause.clauses
      : Array.isArray(clause?.filters)
        ? clause.filters
        : null;

    if (nestedList && nestedList.length > 0) {
      const childExprs = nestedList.map((c: any) => this.buildClause(eb, c, userId));
      let groupExpr: any = childExprs[0];
      for (let i = 1; i < childExprs.length; i++) {
        const childLogicalOp = nestedList[i]?.logicalOperator;
        if (childLogicalOp === 'OR') {
          groupExpr = eb.or([groupExpr, childExprs[i]]);
        } else {
          groupExpr = eb.and([groupExpr, childExprs[i]]);
        }
      }
      return logicalOperator === 'NOT' ? eb.not(groupExpr) : groupExpr;
    }

    const field = clause?.field;
    const operator = clause?.operator ?? 'equals';
    let rawValue: string = String(clause?.value ?? '').trim();
    const column = FIELD_COLUMN[field] ?? 'title';

    let expr: any;

    if (field === 'tags') {
      expr = this.buildTagClause(eb, operator, rawValue);
    } else if (field === 'stateCategory') {
      const categorySubquery = db
        .selectFrom('work_item_states')
        .where(sql<SqlBool>`work_item_states.key = work_items.state AND work_item_states.project_id = work_items.project_id`);

      if (operator === 'in' || operator === 'notIn') {
        const list = this.splitValues(field, rawValue);
        const sub = categorySubquery.where('work_item_states.category', 'in', list as any);
        expr = operator === 'in' ? eb.exists(sub) : eb.notExists(sub);
      } else if (operator === 'notEquals') {
        expr = eb.notExists(categorySubquery.where('work_item_states.category', '=', rawValue as any));
      } else {
        expr = eb.exists(categorySubquery.where('work_item_states.category', '=', rawValue as any));
      }
    } else {
      if (
        (field === 'assignedTo' || field === 'createdBy') &&
        rawValue === '@me'
      ) {
        rawValue = userId;
      }

      if (rawValue === '' && !['isEmpty', 'isNotEmpty'].includes(operator)) {
        expr = eb(column, 'is', null);
      } else {
        switch (operator) {
          case 'notEquals':
            expr = eb(column, '<>', this.coerce(field, rawValue));
            break;
          case 'contains':
            expr = eb(column, 'ilike', `%${rawValue}%`);
            break;
          case 'notContains':
            expr = eb(column, 'not ilike', `%${rawValue}%`);
            break;
          case 'in':
            expr = eb(column, 'in', this.splitValues(field, rawValue));
            break;
          case 'notIn':
            expr = eb(column, 'not in', this.splitValues(field, rawValue));
            break;
          case 'greaterThan':
            expr = eb(column, '>', this.coerce(field, rawValue));
            break;
          case 'greaterThanOrEqual':
            expr = eb(column, '>=', this.coerce(field, rawValue));
            break;
          case 'lessThan':
            expr = eb(column, '<', this.coerce(field, rawValue));
            break;
          case 'lessThanOrEqual':
            expr = eb(column, '<=', this.coerce(field, rawValue));
            break;
          case 'isEmpty':
            expr = eb(column, 'is', null);
            break;
          case 'isNotEmpty':
            expr = eb(column, 'is not', null);
            break;
          case 'after':
            expr = eb(column, '>=', this.coerce(field, rawValue));
            break;
          case 'before':
            expr = eb(column, '<=', this.coerce(field, rawValue));
            break;
          case 'between': {
            const [start, end] = rawValue.split(',').map((v) => v.trim());
            const conds: any[] = [];
            if (start) conds.push(eb(column, '>=', this.coerce(field, start)));
            if (end) conds.push(eb(column, '<=', this.coerce(field, end)));
            if (conds.length === 0) expr = sql`true`;
            else expr = conds.length === 1 ? conds[0] : eb.and(conds);
            break;
          }
          case 'equals':
          default:
            expr = eb(column, '=', this.coerce(field, rawValue));
        }
      }
    }

    return logicalOperator === 'NOT' ? eb.not(expr) : expr;
  }

  private buildTagClause(eb: any, operator: string, rawValue: string) {
    const base = () =>
      db
        .selectFrom('work_item_tags')
        .innerJoin('tags', 'tags.id', 'work_item_tags.tag_id')
        .where(sql<SqlBool>`work_item_tags.work_item_id = work_items.id`);

    const values = () =>
      rawValue
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

    switch (operator) {
      case 'notEquals': {
        const list = values();
        return eb.notExists(
          list.length > 0 ? base().where('tags.name', 'in', list) : base(),
        );
      }
      case 'notContains':
        return eb.notExists(
          base().where('tags.name', 'ilike', `%${rawValue}%`),
        );
      case 'contains':
        return eb.exists(base().where('tags.name', 'ilike', `%${rawValue}%`));
      case 'in': {
        const list = values();
        return eb.exists(
          list.length > 0 ? base().where('tags.name', 'in', list) : base(),
        );
      }
      case 'notIn': {
        const list = values();
        return eb.notExists(
          list.length > 0 ? base().where('tags.name', 'in', list) : base(),
        );
      }
      case 'isEmpty':
        return eb.notExists(base());
      case 'isNotEmpty':
        return eb.exists(base());
      case 'equals':
      default:
        return eb.exists(base().where('tags.name', '=', rawValue));
    }
  }

  private coerce(field: string, value: string) {
    if (DATE_FIELDS.has(field)) {
      const date = new Date(value);
      return isNaN(date.getTime()) ? value : date;
    }
    if (field === 'key') {
      const match = value.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : value;
    }
    if (field === 'points' || field === 'seqNo') {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }
    return value;
  }

  private splitValues(field: string, value: string) {
    return value.split(',').map((v: string) => this.coerce(field, v.trim()));
  }

  private mapQuery(row: any) {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      isShared: row.is_shared,
      createdBy: row.created_by,
      folder: row.folder,
      definition:
        typeof row.definition === 'string'
          ? JSON.parse(row.definition)
          : row.definition,
      sortOrder: row.sort_order,
      lastRunAt: row.ran_at ?? null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    };
  }
}