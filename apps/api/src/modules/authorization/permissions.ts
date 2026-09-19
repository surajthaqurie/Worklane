/**
 * Fine-grained permission definitions for the Worklane authorization system.
 *
 * Permissions are defined per resource and action. Every protected operation
 * in a service must map to exactly one permission, making it trivial to audit
 * what each role can and cannot do.
 *
 * Design principles:
 *  - Members/Owners are derived from the DB, never from client-supplied data.
 *  - project_members.role (OWNER | ADMIN | MEMBER) drives all decisions.
 *  - team_members.role (ADMIN | MEMBER) is an additive layer inside a project.
 */

// ─── Project-level roles ──────────────────────────────────────────────────────

export type ProjectRole = 'OWNER' | 'ADMIN' | 'MEMBER';

// ─── Permission enum ──────────────────────────────────────────────────────────

export enum Permission {
  // ── Project ────────────────────────────────────────────────────────────────
  PROJECT_VIEW = 'project:view',
  PROJECT_EDIT = 'project:edit',
  PROJECT_DELETE = 'project:delete',
  PROJECT_MANAGE_MEMBERS = 'project:manage_members',
  PROJECT_MANAGE_TEAMS = 'project:manage_teams',
  PROJECT_MANAGE_SETTINGS = 'project:manage_settings',

  // ── Work items ─────────────────────────────────────────────────────────────
  WORK_ITEM_VIEW = 'work_item:view',
  WORK_ITEM_CREATE = 'work_item:create',
  WORK_ITEM_EDIT = 'work_item:edit',
  WORK_ITEM_ASSIGN = 'work_item:assign',
  WORK_ITEM_CHANGE_STATE = 'work_item:change_state',
  WORK_ITEM_DELETE = 'work_item:delete',

  // ── Iterations ─────────────────────────────────────────────────────────────
  ITERATION_VIEW = 'iteration:view',
  ITERATION_CREATE = 'iteration:create',
  ITERATION_EDIT = 'iteration:edit',
  ITERATION_COMPLETE = 'iteration:complete',
  ITERATION_DELETE = 'iteration:delete',

  // ── Queries ────────────────────────────────────────────────────────────────
  QUERY_VIEW = 'query:view',
  QUERY_CREATE = 'query:create',
  QUERY_EDIT = 'query:edit',
  QUERY_DELETE = 'query:delete',

  // ── Teams ──────────────────────────────────────────────────────────────────
  TEAM_VIEW = 'team:view',
  TEAM_CREATE = 'team:create',
  TEAM_EDIT = 'team:edit',
  TEAM_DELETE = 'team:delete',
  TEAM_MANAGE_MEMBERS = 'team:manage_members',
  TEAM_MANAGE_SETTINGS = 'team:manage_settings',
}

/**
 * Returns true when `role` grants the given `permission`.
 */
export function hasPermission(_role: ProjectRole, _permission: Permission): boolean {
  // For now: all users have all permissions
  return true;
}

/**
 * Returns the full set of permissions granted to a given role.
 * Useful for serialising the permission set to the frontend.
 */
export function getPermissionsForRole(_role: ProjectRole): Permission[] {
  // For now: all users get all permissions
  return Object.values(Permission) as Permission[];
}
