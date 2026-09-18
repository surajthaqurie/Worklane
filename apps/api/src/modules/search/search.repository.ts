import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { sql, type SqlBool } from 'kysely';
import type { GlobalSearchDto } from './dto/search.dto.js';

export interface WorkItemSearchResult {
  id: string;
  key: string;
  projectId: string;
  project: { id: string; key: string; name: string };
  type: string;
  title: string;
  state: string;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedToAvatar: string | null;
  updatedAt: Date;
}

export interface GlobalSearchResponse {
  items: WorkItemSearchResult[];
  total: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 256;

@Injectable()
export class SearchRepository {
  /**
   * Global, project-scoped work item search.
   *
   * Results are always restricted to projects the requesting user can access
   * (projects they created or are a member of), enforced at the SQL level so a
   * foreign project can never leak into the response.
   *
   * The free-text query is matched against the GIN-indexed `search_vector`
   * (title + description), plus case-insensitive title/description/tag assignee
   * matching and the per-project key (`KEY-123`) / numeric ID pattern.
   */
  async searchWorkItems(
    userId: string,
    filters: GlobalSearchDto,
  ): Promise<GlobalSearchResponse> {
    const q = filters.q?.trim() ?? '';
    const searchQ = q.slice(0, MAX_QUERY_LENGTH);
    const limit = Math.min(parseInt(filters.limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(parseInt(filters.offset ?? '0', 10) || 0, 0);

    const tagList = filters.tags
      ? filters.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const hasCriteria = Boolean(
      searchQ || filters.type || filters.state || filters.assignedTo || tagList.length > 0,
    );
    if (!hasCriteria) return { items: [], total: 0 };

    let query = db
      .selectFrom('work_items as wi')
      .innerJoin('projects as p', 'p.id', 'wi.project_id')
      .leftJoin('users as u', 'u.id', 'wi.assigned_to');

    // Optional single-project scope. Membership is asserted upstream in the
    // service via assertProjectMember.
    if (filters.projectId) {
      query = query.where('wi.project_id', '=', filters.projectId);
    } else {
      query = query.where((eb) =>
        eb(
          'wi.project_id',
          'in',
          db
            .selectFrom('projects as p')
            .leftJoin('project_members as pm', 'pm.project_id', 'p.id')
            .where((eb2) =>
              eb2.or([
                eb2('p.created_by', '=', userId),
                eb2('pm.user_id', '=', userId),
              ]),
            )
            .select('p.id'),
        ),
      );
    }

    if (searchQ) {
      query = query.where((eb) => {
        const conditions: any[] = [
          sql<SqlBool>`wi.search_vector @@ plainto_tsquery('english', ${searchQ})`,
          eb('wi.title', 'ilike', `%${searchQ}%`),
          eb('wi.description', 'ilike', `%${searchQ}%`),
          // Match assigned user by name directly using the joined table
          eb('u.name', 'ilike', `%${searchQ}%`),
          // Match tags.
          eb.exists(
            eb
              .selectFrom('work_item_tags as wit')
              .innerJoin('tags as t', 't.id', 'wit.tag_id')
              .whereRef('wit.work_item_id', '=', 'wi.id')
              .where('t.name', 'ilike', `%${searchQ}%`)
              .select('wit.work_item_id'),
          ),
        ];

        // Match raw work item ID if search term is a valid UUID format
        if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(searchQ)) {
          conditions.push(eb('wi.id', '=', searchQ));
        }

        // Project key + sequence ("PROJ-123") or bare sequence ("123").
        const seqMatch = searchQ.match(/(?:^[a-zA-Z]+-)?(\d+)$/);
        if (seqMatch) {
          conditions.push(eb('wi.seq_no', '=', parseInt(seqMatch[1], 10)));
        }

        return eb.or(conditions);
      });
    }

    if (filters.type) query = query.where('wi.type', '=', filters.type as any);
    if (filters.state) query = query.where('wi.state', '=', filters.state);
    if (filters.assignedTo) {
      if (filters.assignedTo === 'UNASSIGNED') {
        query = query.where('wi.assigned_to', 'is', null);
      } else {
        query = query.where('wi.assigned_to', '=', filters.assignedTo);
      }
    }
    if (tagList.length > 0) {
      query = query.where((eb) =>
        eb(
          'wi.id',
          'in',
          db
            .selectFrom('work_item_tags as wit')
            .innerJoin('tags as t', 't.id', 'wit.tag_id')
            .where('t.name', 'in', tagList)
            .select('wit.work_item_id'),
        ),
      );
    }

    // Total matching count before pagination.
    const countResult = await query
      .select(sql<number>`count(*)`.as('count'))
      .executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    // Most relevant first when a free-text query is present, otherwise most
    // recently updated first.
    if (searchQ) {
      query = query.orderBy(
        sql`ts_rank(wi.search_vector, plainto_tsquery('english', ${searchQ}))`,
        'desc',
      );
    }
    query = query.orderBy('wi.updated_at', 'desc');

    const rows = await query
      .select([
        'wi.id',
        'wi.seq_no',
        'wi.project_id',
        'wi.type',
        'wi.title',
        'wi.state',
        'wi.assigned_to',
        'u.name as assigned_to_name',
        'u.avatar_url as assigned_to_avatar',
        'wi.updated_at',
        'p.key as project_key',
        'p.name as project_name',
      ])
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        key: `${(row as any).project_key}-${row.seq_no}`,
        projectId: row.project_id,
        project: {
          id: row.project_id,
          key: (row as any).project_key,
          name: (row as any).project_name,
        },
        type: row.type,
        title: row.title,
        state: row.state,
        assignedTo: row.assigned_to,
        assignedToName: (row as any).assigned_to_name,
        assignedToAvatar: (row as any).assigned_to_avatar,
        updatedAt: row.updated_at,
      })),
    };
  }
}