import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';

const FIELD_COLUMN: Record<string, string> = {
  key: 'seq_no',
  type: 'type',
  title: 'title',
  description: 'description',
  state: 'state',
  priority: 'priority',
  assignedTo: 'assigned_to',
  iterationId: 'iteration_id',
  parentId: 'parent_id',
  createdBy: 'created_by',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  completedAt: 'completed_at',
};

const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'completedAt']);

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
          expr =
            clauses[i]?.logicalOperator === 'OR'
              ? eb.or([expr, conditions[i]])
              : eb.and([expr, conditions[i]]);
        }
        return expr;
      });
    }

    const rows = await query
      .selectAll()
      .orderBy(sortColumn as any, sortDir as 'asc' | 'desc')
      .limit(limit)
      .execute();

    return rows.map((r) => ({
      id: r.id,
      key: `${projectKey}-${r.seq_no}`,
      projectId: r.project_id,
      iterationId: r.iteration_id,
      seqNo: r.seq_no,
      parentId: r.parent_id,
      type: r.type,
      title: r.title,
      description: r.description,
      state: r.state,
      priority: r.priority,
      assignedTo: r.assigned_to,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      completedAt: r.completed_at,
    }));
  }

  private buildClause(eb: any, clause: any, userId: string) {
    const field = clause?.field;
    const operator = clause?.operator ?? 'equals';
    let rawValue: string = (clause?.value ?? '').toString().trim();
    const column = FIELD_COLUMN[field] ?? 'title';

    if (
      (field === 'assignedTo' || field === 'createdBy') &&
      rawValue === '@me'
    ) {
      rawValue = userId;
    }

    if (rawValue === '') {
      return eb(column, 'is', null);
    }

    switch (operator) {
      case 'notEquals':
        return eb(column, '<>', this.coerce(field, rawValue));
      case 'contains':
        return eb(column, 'ilike', `%${rawValue}%`);
      case 'notContains':
        return eb(column, 'not ilike', `%${rawValue}%`);
      case 'in':
        return eb(column, 'in', this.splitValues(field, rawValue));
      case 'notIn':
        return eb(column, 'not in', this.splitValues(field, rawValue));
      case 'isEmpty':
        return eb(column, 'is', null);
      case 'isNotEmpty':
        return eb(column, 'is not', null);
      case 'after':
        return eb(column, '>=', this.coerce(field, rawValue));
      case 'before':
        return eb(column, '<=', this.coerce(field, rawValue));
      case 'between': {
        const [start, end] = rawValue.split(',').map((v) => v.trim());
        return eb.and([
          eb(column, '>=', this.coerce(field, start || rawValue)),
          eb(column, '<=', this.coerce(field, end || rawValue)),
        ]);
      }
      case 'equals':
      default:
        return eb(column, '=', this.coerce(field, rawValue));
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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}