import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import {
  HistoryExecutor,
  HistoryQueryFilters,
  HistoryRowWithActor,
  WorkItemHistoryRepository,
} from './work-item-history.repository.js';
import {
  WorkItemHistoryAction,
  WorkItemHistoryEntryInput,
} from './work-item-history.constants.js';

export interface WorkItemHistoryActor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface WorkItemHistoryItem {
  id: string;
  workItemId: string;
  action: string;
  field: string | null;
  fieldName: string;
  before: string | null;
  after: string | null;
  rawBefore: string | null;
  rawAfter: string | null;
  changedBy: WorkItemHistoryActor;
  changedAt: Date;
  description: string;
}

export interface WorkItemHistoryGroup {
  groupId: string;
  changedBy: WorkItemHistoryActor;
  changedAt: Date;
  summary: string;
  items: WorkItemHistoryItem[];
}

export interface PaginatedWorkItemHistory {
  items: WorkItemHistoryItem[];
  groups: WorkItemHistoryGroup[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface WorkItemActivityEntry {
  id: string;
  workItemId: string;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  action: string;
  field: string | null;
  previousValue: string | null;
  newValue: string | null;
  previousLabel: string | null;
  newLabel: string | null;
  description: string;
  createdAt: Date;
}

interface HistoryLookups {
  users: Map<string, string>;
  iterations: Map<string, string>;
  areas: Map<string, string>;
  parents: Map<string, string>;
}

/** "IN_PROGRESS" -> "In Progress", "New" -> "New", "TODO" -> "Todo". */
export function prettifyKey(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolves a structured stored value (e.g. a user UUID in the assigned_to
 * field) into a display label. Unknown UUIDs fall back to the raw value so
 * audit entries remain self-describing even after the referenced entity is
 * gone.
 */
export function resolveHistoryLabel(
  field: string | null,
  value: string | null,
  lookups: HistoryLookups,
): string | null {
  if (value === null || value === undefined || value === '') return null;

  switch (field) {
    case 'assigned_to':
      return lookups.users.get(value) ?? value;
    case 'iteration_id':
      return lookups.iterations.get(value) ?? value;
    case 'area_id':
      return lookups.areas.get(value) ?? value;
    case 'parent_id':
      return lookups.parents.get(value) ?? value;
    case 'state':
    case 'priority':
      return prettifyKey(value);
    default:
      return value;
  }
}

export interface HistoryDescriptionSource {
  action: string;
  previousLabel: string | null;
  newLabel: string | null;
}

/**
 * Generates a human-readable description from structured history data at read
 * time. The DB stores only structured fields (action, field, old/new values);
 * the sentence is derived, never persisted, so future reporting features can
 * reason over the raw data directly.
 */
export function describeHistoryEntry(source: HistoryDescriptionSource): string {
  const { action, previousLabel: old, newLabel: next } = source;

  switch (action) {
    case WorkItemHistoryAction.CREATED:
      return 'created this work item';
    case WorkItemHistoryAction.DELETED:
      return 'deleted this work item';

    case WorkItemHistoryAction.TITLE_CHANGED:
      if (old && next) return `renamed from "${old}" to "${next}"`;
      if (next) return `set the title to "${next}"`;
      return 'changed the title';

    case WorkItemHistoryAction.DESCRIPTION_CHANGED:
      if (old && next) return 'updated the description';
      if (next) return 'added a description';
      if (old) return 'removed the description';
      return 'updated the description';

    case WorkItemHistoryAction.STATE_CHANGED:
      if (old && next) return `moved from ${old} to ${next}`;
      if (next) return `set state to ${next}`;
      return 'changed the state';

    case WorkItemHistoryAction.PRIORITY_CHANGED:
      if (old && next) return `changed priority from ${old} to ${next}`;
      if (next) return `set priority to ${next}`;
      return 'changed priority';

    case WorkItemHistoryAction.POINTS_CHANGED:
      if (old && next) return `changed points from ${old} to ${next}`;
      if (next) return `set points to ${next}`;
      if (old) return `cleared points (was ${old})`;
      return 'changed points';

    case WorkItemHistoryAction.TYPE_CHANGED:
      if (old && next) return `changed type from ${old} to ${next}`;
      if (next) return `set type to ${next}`;
      return 'changed type';

    case WorkItemHistoryAction.ASSIGNEE_CHANGED:
      if (old && next) return `reassigned from ${old} to ${next}`;
      if (next) return `assigned to ${next}`;
      if (old) return `unassigned ${old}`;
      return 'changed assignment';

    case WorkItemHistoryAction.PARENT_CHANGED:
      if (old && next) return `moved under ${next} (was ${old})`;
      if (next) return `linked under ${next}`;
      if (old) return `unlinked from ${old}`;
      return 'changed the parent';

    case WorkItemHistoryAction.ITERATION_CHANGED:
      if (old && next) return `moved from ${old} to ${next}`;
      if (next) return `added to ${next}`;
      if (old) return `moved ${old} to the backlog`;
      return 'changed iteration';

    case WorkItemHistoryAction.AREA_CHANGED:
      if (old && next) return `moved area from ${old} to ${next}`;
      if (next) return `assigned to ${next}`;
      if (old) return `removed from ${old}`;
      return 'changed area';

    case WorkItemHistoryAction.TAGS_CHANGED:
      if (old && next) return `updated tags from ${old} to ${next}`;
      if (next) return `added tags: ${next}`;
      if (old) return `removed all tags`;
      return 'updated tags';

    case WorkItemHistoryAction.ORDER_CHANGED:
      return 'reordered this item';

    case WorkItemHistoryAction.COMMENT_ADDED:
      return 'added a comment';
    case WorkItemHistoryAction.COMMENT_UPDATED:
      return 'edited a comment';
    case WorkItemHistoryAction.COMMENT_DELETED:
      return 'deleted a comment';

    default:
      return prettifyKey(action).toLowerCase();
  }
}

export function fieldNameFromKey(field: string | null, action?: string): string {
  if (!field) {
    if (action === WorkItemHistoryAction.CREATED) return 'Item Created';
    if (action === WorkItemHistoryAction.DELETED) return 'Item Deleted';
    if (action === WorkItemHistoryAction.COMMENT_ADDED) return 'Comment Added';
    if (action === WorkItemHistoryAction.COMMENT_UPDATED) return 'Comment Edited';
    if (action === WorkItemHistoryAction.COMMENT_DELETED) return 'Comment Deleted';
    return 'General';
  }
  switch (field) {
    case 'title':
      return 'Title';
    case 'description':
      return 'Description';
    case 'state':
      return 'State';
    case 'priority':
      return 'Priority';
    case 'severity':
      return 'Severity';
    case 'type':
      return 'Type';
    case 'points':
      return 'Story Points';
    case 'assigned_to':
      return 'Assignee';
    case 'parent_id':
      return 'Parent Item';
    case 'iteration_id':
      return 'Iteration';
    case 'area_id':
      return 'Area';
    case 'tags':
      return 'Tags';
    case 'backlog_order':
      return 'Backlog Order';
    case 'remaining_work':
      return 'Remaining Work';
    case 'completed_work':
      return 'Completed Work';
    case 'start_date':
      return 'Start Date';
    case 'target_date':
      return 'Target Date';
    case 'custom_fields':
      return 'Custom Fields';
    default:
      return prettifyKey(field);
  }
}

const SENSITIVE_FIELD_PATTERN = /(password|token|secret|key|hash|credential|auth)/i;

export function sanitizeHistoryValue(field: string | null, value: string | null): string | null {
  if (value === null || value === undefined) return null;
  if (field && SENSITIVE_FIELD_PATTERN.test(field)) {
    return '[REDACTED]';
  }
  return value;
}

export function groupHistoryItems(items: WorkItemHistoryItem[]): WorkItemHistoryGroup[] {
  if (items.length === 0) return [];

  const groups: WorkItemHistoryGroup[] = [];
  let currentGroup: WorkItemHistoryGroup | null = null;

  for (const item of items) {
    const itemTime = new Date(item.changedAt).getTime();

    if (
      currentGroup &&
      currentGroup.changedBy.id === item.changedBy.id &&
      Math.abs(itemTime - new Date(currentGroup.changedAt).getTime()) <= 5000
    ) {
      currentGroup.items.push(item);
    } else {
      currentGroup = {
        groupId: `group_${item.id}`,
        changedBy: item.changedBy,
        changedAt: item.changedAt,
        summary: item.description,
        items: [item],
      };
      groups.push(currentGroup);
    }
  }

  for (const group of groups) {
    if (group.items.length > 1) {
      const fieldNames = Array.from(new Set(group.items.map((i) => i.fieldName)));
      group.summary = `Updated ${fieldNames.join(', ')}`;
    }
  }

  return groups;
}

@Injectable()
export class WorkItemHistoryService {
  constructor(private readonly repository: WorkItemHistoryRepository) {}

  async record(executor: HistoryExecutor, entry: WorkItemHistoryEntryInput) {
    await this.repository.insertMany(executor, [this.toRow(entry)]);
  }

  async recordMany(
    executor: HistoryExecutor,
    entries: WorkItemHistoryEntryInput[],
  ) {
    await this.repository.insertMany(executor, entries.map((e) => this.toRow(e)));
  }

  private toRow(entry: WorkItemHistoryEntryInput) {
    return {
      work_item_id: entry.workItemId,
      user_id: entry.actorId,
      action: entry.action,
      field: entry.field ?? null,
      old_value: this.stringify(entry.previousValue),
      new_value: this.stringify(entry.newValue),
    };
  }

  private stringify(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  /**
   * Returns the activity timeline for a work item, oldest first. Structured
   * values are enriched into display labels and a human-readable description.
   */
  async getActivity(workItemId: string, limit?: number): Promise<WorkItemActivityEntry[]> {
    const rows = await this.repository.findByWorkItemId(workItemId, limit);
    if (rows.length === 0) return [];

    const lookups = await this.loadLookups(rows);

    return rows.map((row) => {
      const previousLabel = resolveHistoryLabel(row.field, row.old_value, lookups);
      const newLabel = resolveHistoryLabel(row.field, row.new_value, lookups);

      return {
        id: row.id,
        workItemId: row.work_item_id,
        actorId: row.user_id,
        actorName: row.user_name,
        actorAvatarUrl: row.user_avatar_url,
        action: row.action,
        field: row.field,
        previousValue: row.old_value,
        newValue: row.new_value,
        previousLabel,
        newLabel,
        description: describeHistoryEntry({
          action: row.action,
          previousLabel,
          newLabel,
        }),
        createdAt: row.created_at,
      };
    });
  }

  /**
   * Returns paginated and filtered history for a work item, with changes grouped appropriately.
   * Enforces safe limit bounds (default 20, max 100).
   */
  async getHistory(
    workItemId: string,
    options: HistoryQueryFilters = {},
  ): Promise<PaginatedWorkItemHistory> {
    const { rows, total, page, limit } = await this.repository.findWithPaginationAndFilters(
      workItemId,
      options,
    );

    if (rows.length === 0) {
      return {
        items: [],
        groups: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
        hasMore: false,
      };
    }

    const lookups = await this.loadLookups(rows);

    const items: WorkItemHistoryItem[] = rows.map((row) => {
      const resolvedPrev = resolveHistoryLabel(row.field, row.old_value, lookups);
      const resolvedNext = resolveHistoryLabel(row.field, row.new_value, lookups);

      const before = sanitizeHistoryValue(row.field, resolvedPrev);
      const after = sanitizeHistoryValue(row.field, resolvedNext);
      const rawBefore = sanitizeHistoryValue(row.field, row.old_value);
      const rawAfter = sanitizeHistoryValue(row.field, row.new_value);

      const description = describeHistoryEntry({
        action: row.action,
        previousLabel: before,
        newLabel: after,
      });

      return {
        id: row.id,
        workItemId: row.work_item_id,
        action: row.action,
        field: row.field,
        fieldName: fieldNameFromKey(row.field, row.action),
        before,
        after,
        rawBefore,
        rawAfter,
        changedBy: {
          id: row.user_id,
          name: row.user_name || 'System User',
          avatarUrl: row.user_avatar_url,
        },
        changedAt: row.created_at,
        description,
      };
    });

    const groups = groupHistoryItems(items);

    return {
      items,
      groups,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    };
  }

  private async loadLookups(rows: HistoryRowWithActor[]): Promise<HistoryLookups> {
    const userIds = new Set<string>();
    const iterationIds = new Set<string>();
    const areaIds = new Set<string>();
    const parentIds = new Set<string>();

    for (const row of rows) {
      for (const value of [row.old_value, row.new_value]) {
        if (!value) continue;
        switch (row.field) {
          case 'assigned_to':
            userIds.add(value);
            break;
          case 'iteration_id':
            iterationIds.add(value);
            break;
          case 'area_id':
            areaIds.add(value);
            break;
          case 'parent_id':
            parentIds.add(value);
            break;
        }
      }
    }

    const [users, iterations, areas, parents] = await Promise.all([
      userIds.size > 0
        ? db
            .selectFrom('users')
            .where('id', 'in', [...userIds])
            .select(['id', 'name'])
            .execute()
        : [],
      iterationIds.size > 0
        ? db
            .selectFrom('iterations')
            .where('id', 'in', [...iterationIds])
            .select(['id', 'name'])
            .execute()
        : [],
      areaIds.size > 0
        ? db
            .selectFrom('areas')
            .where('id', 'in', [...areaIds])
            .select(['id', 'name'])
            .execute()
        : [],
      parentIds.size > 0
        ? db
            .selectFrom('work_items')
            .leftJoin('projects', 'projects.id', 'work_items.project_id')
            .where('work_items.id', 'in', [...parentIds])
            .select([
              'work_items.id',
              'work_items.title',
              'work_items.seq_no',
              'projects.key as project_key',
            ])
            .execute()
        : [],
    ]);

    return {
      users: new Map(users.map((u) => [u.id, u.name])),
      iterations: new Map(iterations.map((i) => [i.id, i.name])),
      areas: new Map(areas.map((a) => [a.id, a.name])),
      parents: new Map(
        parents.map((p) => [
          p.id,
          p.project_key ? `${p.project_key}-${p.seq_no} · ${p.title}` : p.title,
        ]),
      ),
    };
  }
}