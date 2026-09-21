import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { BoardColumn, CardFields, FilterConfig, SwimlaneType } from './dto/boards.dto.js';

export interface BoardRow {
  id: string;
  projectId: string;
  teamId: string | null;
  name: string;
  description: string | null;
  isDefault: boolean;
  swimlane: SwimlaneType;
  columns: BoardColumn[];
  cardFields: CardFields;
  filterConfig: FilterConfig;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class BoardsRepository {
  async listByProject(projectId: string, teamId?: string | null): Promise<BoardRow[]> {
    let query = db.selectFrom('boards').where('project_id', '=', projectId);
    if (teamId !== undefined) {
      if (teamId === null) {
        query = query.where('team_id', 'is', null);
      } else {
        query = query.where((eb) =>
          eb.or([eb('team_id', '=', teamId), eb('team_id', 'is', null)]),
        );
      }
    }
    const rows = await query
      .selectAll()
      .orderBy('is_default', 'desc')
      .orderBy('created_at', 'asc')
      .execute();

    return rows.map((r) => this.mapRow(r));
  }

  async getById(projectId: string, id: string): Promise<BoardRow | null> {
    const row = await db
      .selectFrom('boards')
      .where('project_id', '=', projectId)
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst();

    return row ? this.mapRow(row) : null;
  }

  async create(data: {
    projectId: string;
    teamId?: string | null;
    name: string;
    description?: string | null;
    isDefault?: boolean;
    swimlane?: SwimlaneType;
    columns: BoardColumn[];
    cardFields: CardFields;
    filterConfig: FilterConfig;
  }): Promise<BoardRow> {
    const row = await db
      .insertInto('boards')
      .values({
        project_id: data.projectId,
        team_id: data.teamId || null,
        name: data.name,
        description: data.description || null,
        is_default: data.isDefault ?? false,
        swimlane: data.swimlane ?? 'none',
        columns: JSON.stringify(data.columns),
        card_fields: JSON.stringify(data.cardFields),
        filter_config: JSON.stringify(data.filterConfig),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapRow(row);
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      teamId?: string | null;
      isDefault?: boolean;
      swimlane?: SwimlaneType;
      columns?: BoardColumn[];
      cardFields?: CardFields;
      filterConfig?: FilterConfig;
    },
  ): Promise<BoardRow> {
    const updatePayload: Record<string, any> = { updated_at: new Date() };
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.teamId !== undefined) updatePayload.team_id = data.teamId;
    if (data.isDefault !== undefined) updatePayload.is_default = data.isDefault;
    if (data.swimlane !== undefined) updatePayload.swimlane = data.swimlane;
    if (data.columns !== undefined) updatePayload.columns = JSON.stringify(data.columns);
    if (data.cardFields !== undefined) updatePayload.card_fields = JSON.stringify(data.cardFields);
    if (data.filterConfig !== undefined) updatePayload.filter_config = JSON.stringify(data.filterConfig);

    const row = await db
      .updateTable('boards')
      .set(updatePayload)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapRow(row);
  }

  async remove(id: string): Promise<void> {
    await db.deleteFrom('boards').where('id', '=', id).execute();
  }

  async getProjectStates(projectId: string) {
    return db
      .selectFrom('work_item_states')
      .where('project_id', '=', projectId)
      .selectAll()
      .orderBy('sort_order', 'asc')
      .execute();
  }

  async getWorkItemForMove(projectId: string, workItemId: string) {
    return db
      .selectFrom('work_items')
      .where('project_id', '=', projectId)
      .where('id', '=', workItemId)
      .select(['id', 'project_id', 'state', 'type', 'assigned_to', 'parent_id'])
      .executeTakeFirst();
  }

  async countItemsInStates(
    projectId: string,
    states: string[],
    typeScope?: Array<'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG'>,
  ): Promise<number> {
    let query = db
      .selectFrom('work_items')
      .where('project_id', '=', projectId)
      .where('state', 'in', states);
    if (typeScope && typeScope.length > 0) {
      query = query.where('type', 'in', typeScope);
    }
    const row = await query
      .select(db.fn.countAll().as('count'))
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  async listProjectMemberIds(projectId: string): Promise<string[]> {
    const rows = await db
      .selectFrom('project_members')
      .where('project_id', '=', projectId)
      .select('user_id')
      .execute();
    return rows.map((r) => r.user_id);
  }

  private mapRow(r: any): BoardRow {
    return {
      id: r.id,
      projectId: r.project_id,
      teamId: r.team_id,
      name: r.name,
      description: r.description,
      isDefault: r.is_default,
      swimlane: r.swimlane || 'none',
      columns: typeof r.columns === 'string' ? JSON.parse(r.columns) : (r.columns || []),
      cardFields: typeof r.card_fields === 'string' ? JSON.parse(r.card_fields) : (r.card_fields || {}),
      filterConfig: typeof r.filter_config === 'string' ? JSON.parse(r.filter_config) : (r.filter_config || {}),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
