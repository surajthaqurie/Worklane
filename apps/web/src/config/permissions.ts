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
export type PermissionValue =
  | 'project:view'
  | 'project:edit'
  | 'project:delete'
  | 'project:manage_members'
  | 'project:manage_teams'
  | 'project:manage_settings'
  | 'work_item:view'
  | 'work_item:create'
  | 'work_item:edit'
  | 'work_item:assign'
  | 'work_item:change_state'
  | 'work_item:delete'
  | 'iteration:view'
  | 'iteration:create'
  | 'iteration:edit'
  | 'iteration:complete'
  | 'iteration:delete'
  | 'query:view'
  | 'query:create'
  | 'query:edit'
  | 'query:delete'
  | 'delivery_plan:view'
  | 'delivery_plan:create'
  | 'delivery_plan:edit'
  | 'delivery_plan:delete'
  | 'work_item:link_view'
  | 'work_item:link_create'
  | 'work_item:link_delete'
  | 'team:view'
  | 'team:create'
  | 'team:edit'
  | 'team:delete'
  | 'team:manage_members'
  | 'team:manage_settings';

export type ProjectRole = 'OWNER' | 'ADMIN' | 'MEMBER';