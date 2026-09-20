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

  // ── Member ─────────────────────────────────────────────────────────────────
  MEMBER_VIEW = 'member:view',
  MEMBER_MANAGE = 'member:manage',

  // ── Work items ─────────────────────────────────────────────────────────────
  WORK_ITEM_VIEW = 'work_item:view',
  WORK_ITEM_CREATE = 'work_item:create',
  WORK_ITEM_EDIT = 'work_item:edit',
  WORK_ITEM_ASSIGN = 'work_item:assign',
  WORK_ITEM_CHANGE_STATE = 'work_item:change_state',
  WORK_ITEM_REORDER = 'work_item:reorder',
  WORK_ITEM_BULK_EDIT = 'work_item:bulk_edit',
  WORK_ITEM_DELETE = 'work_item:delete',

  // ── Boards & Backlogs ──────────────────────────────────────────────────────
  BOARD_VIEW = 'board:view',
  BOARD_MANAGE = 'board:manage',
  BACKLOG_VIEW = 'backlog:view',
  BACKLOG_MANAGE = 'backlog:manage',

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
  TEAM_MANAGE = 'team:manage',
  TEAM_CREATE = 'team:create',
  TEAM_EDIT = 'team:edit',
  TEAM_DELETE = 'team:delete',
  TEAM_MANAGE_MEMBERS = 'team:manage_members',
  TEAM_MANAGE_SETTINGS = 'team:manage_settings',
}

const MEMBER_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.PROJECT_VIEW,
  Permission.MEMBER_VIEW,
  Permission.WORK_ITEM_VIEW,
  Permission.WORK_ITEM_CREATE,
  Permission.WORK_ITEM_EDIT,
  Permission.WORK_ITEM_ASSIGN,
  Permission.WORK_ITEM_CHANGE_STATE,
  Permission.WORK_ITEM_REORDER,
  Permission.BOARD_VIEW,
  Permission.BACKLOG_VIEW,
  Permission.ITERATION_VIEW,
  Permission.QUERY_VIEW,
  Permission.QUERY_CREATE,
  Permission.QUERY_EDIT,
  Permission.TEAM_VIEW,
]);

const ADMIN_PERMISSIONS: ReadonlySet<Permission> = new Set([
  ...MEMBER_PERMISSIONS,
  Permission.PROJECT_EDIT,
  Permission.PROJECT_MANAGE_MEMBERS,
  Permission.PROJECT_MANAGE_TEAMS,
  Permission.PROJECT_MANAGE_SETTINGS,
  Permission.MEMBER_MANAGE,
  Permission.WORK_ITEM_DELETE,
  Permission.WORK_ITEM_BULK_EDIT,
  Permission.BOARD_MANAGE,
  Permission.BACKLOG_MANAGE,
  Permission.ITERATION_CREATE,
  Permission.ITERATION_EDIT,
  Permission.ITERATION_COMPLETE,
  Permission.ITERATION_DELETE,
  Permission.QUERY_DELETE,
  Permission.TEAM_MANAGE,
  Permission.TEAM_CREATE,
  Permission.TEAM_EDIT,
  Permission.TEAM_DELETE,
  Permission.TEAM_MANAGE_MEMBERS,
  Permission.TEAM_MANAGE_SETTINGS,
]);

const OWNER_PERMISSIONS: ReadonlySet<Permission> = new Set(Object.values(Permission));

const VALID_PERMISSIONS = new Set(Object.values(Permission));

/**
 * Returns true when `role` grants the given `permission`.
 * Returns FALSE for any unknown role or permission (Default DENY).
 */
export function hasPermission(role: ProjectRole | string, permission: Permission | string): boolean {
  if (!role || !permission || !VALID_PERMISSIONS.has(permission as Permission)) {
    return false;
  }
  switch (role) {
    case 'OWNER':
      return OWNER_PERMISSIONS.has(permission as Permission);
    case 'ADMIN':
      return ADMIN_PERMISSIONS.has(permission as Permission);
    case 'MEMBER':
      return MEMBER_PERMISSIONS.has(permission as Permission);
    default:
      return false; // NEVER DEFAULT TO ALLOW
  }
}

/**
 * Returns the full set of permissions granted to a given role.
 * Useful for serialising the permission set to the frontend.
 */
export function getPermissionsForRole(role: ProjectRole): Permission[] {
  switch (role) {
    case 'OWNER':
      return Array.from(OWNER_PERMISSIONS);
    case 'ADMIN':
      return Array.from(ADMIN_PERMISSIONS);
    case 'MEMBER':
      return Array.from(MEMBER_PERMISSIONS);
    default:
      return [];
  }
}
