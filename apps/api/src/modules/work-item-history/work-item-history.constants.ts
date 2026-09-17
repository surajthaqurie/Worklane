/**
 * Canonical vocabulary for work-item history/audit records.
 *
 * History records are immutable, structured log entries. The action and field
 * constants below are the single source of truth so every write path (work
 * items, backlog reordering, iterations) records consistent values that
 * reporting/audit features can rely on later.
 */

export const WorkItemHistoryAction = {
  // Work item lifecycle
  CREATED: 'CREATED',
  DELETED: 'DELETED',

  // Field changes (field = the work_items column)
  TITLE_CHANGED: 'TITLE_CHANGED',
  DESCRIPTION_CHANGED: 'DESCRIPTION_CHANGED',
  STATE_CHANGED: 'STATE_CHANGED',
  PRIORITY_CHANGED: 'PRIORITY_CHANGED',
  POINTS_CHANGED: 'POINTS_CHANGED',
  TYPE_CHANGED: 'TYPE_CHANGED',
  ASSIGNEE_CHANGED: 'ASSIGNEE_CHANGED',
  PARENT_CHANGED: 'PARENT_CHANGED',
  ITERATION_CHANGED: 'ITERATION_CHANGED',
  AREA_CHANGED: 'AREA_CHANGED',
  TAGS_CHANGED: 'TAGS_CHANGED',
  ORDER_CHANGED: 'ORDER_CHANGED',

  // Comments
  COMMENT_ADDED: 'COMMENT_ADDED',
  COMMENT_UPDATED: 'COMMENT_UPDATED',
  COMMENT_DELETED: 'COMMENT_DELETED',
} as const;

export type WorkItemHistoryAction =
  (typeof WorkItemHistoryAction)[keyof typeof WorkItemHistoryAction];

export const WorkItemHistoryField = {
  TITLE: 'title',
  DESCRIPTION: 'description',
  STATE: 'state',
  PRIORITY: 'priority',
  POINTS: 'points',
  TYPE: 'type',
  ASSIGNEE: 'assigned_to',
  PARENT: 'parent_id',
  ITERATION: 'iteration_id',
  AREA: 'area_id',
  TAGS: 'tags',
  ORDER: 'backlog_order',
  RANK: 'backlog_rank',
  COMMENT: 'comment',
} as const;

export type WorkItemHistoryField =
  (typeof WorkItemHistoryField)[keyof typeof WorkItemHistoryField];

export interface WorkItemHistoryEntryInput {
  workItemId: string;
  actorId: string;
  action: WorkItemHistoryAction;
  field?: WorkItemHistoryField | string | null;
  previousValue?: string | number | Date | null;
  newValue?: string | number | Date | null;
}