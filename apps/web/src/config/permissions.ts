'use client';

/**
 * Frontend permission hooks for Worklane.
 *
 * These mirror the Permission enum defined on the backend
 * (apps/api/src/modules/authorization/permissions.ts).
 *
 * The values MUST stay in sync with the backend enum strings.
 * They are used purely for UX gating — the real security enforcement
 * happens on the backend via AuthorizationService.
 */

export const Permission = {
  // Project
  PROJECT_VIEW: 'project:view',
  PROJECT_EDIT: 'project:edit',
  PROJECT_DELETE: 'project:delete',
  PROJECT_MANAGE_MEMBERS: 'project:manage_members',
  PROJECT_MANAGE_TEAMS: 'project:manage_teams',
  PROJECT_MANAGE_SETTINGS: 'project:manage_settings',

  // Work items
  WORK_ITEM_VIEW: 'work_item:view',
  WORK_ITEM_CREATE: 'work_item:create',
  WORK_ITEM_EDIT: 'work_item:edit',
  WORK_ITEM_ASSIGN: 'work_item:assign',
  WORK_ITEM_CHANGE_STATE: 'work_item:change_state',
  WORK_ITEM_DELETE: 'work_item:delete',

  // Iterations
  ITERATION_VIEW: 'iteration:view',
  ITERATION_CREATE: 'iteration:create',
  ITERATION_EDIT: 'iteration:edit',
  ITERATION_COMPLETE: 'iteration:complete',
  ITERATION_DELETE: 'iteration:delete',

  // Queries
  QUERY_VIEW: 'query:view',
  QUERY_CREATE: 'query:create',
  QUERY_EDIT: 'query:edit',
  QUERY_DELETE: 'query:delete',

  // Teams
  TEAM_VIEW: 'team:view',
  TEAM_CREATE: 'team:create',
  TEAM_EDIT: 'team:edit',
  TEAM_DELETE: 'team:delete',
  TEAM_MANAGE_MEMBERS: 'team:manage_members',
  TEAM_MANAGE_SETTINGS: 'team:manage_settings',
} as const;

export type PermissionKey = keyof typeof Permission;
export type PermissionValue = (typeof Permission)[PermissionKey];
export type ProjectRole = 'OWNER' | 'ADMIN' | 'MEMBER';
