import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { Permission, ProjectRole, hasPermission, getPermissionsForRole } from './permissions.js';

export interface ProjectMembership {
  projectId: string;
  userId: string;
  role: ProjectRole;
}

/** Raw `projects` row as returned by `requireProjectPermissionWithProject`. */
export interface ProjectRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  key: string;
  created_by: string;
  archived: boolean;
  next_work_item_seq: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Central authorization service.
 *
 * NEVER trusts a projectId supplied by the frontend for security decisions.
 * All project-scoping is derived from the authenticated user's membership in
 * the database.
 *
 * Usage pattern in a service:
 *   const membership = await this.authz.requireProjectPermission(
 *     projectId, userId, Permission.WORK_ITEM_CREATE
 *   );
 *   // `membership.role` is available if you need it
 */
@Injectable()
export class AuthorizationService {
  /**
   * Resolves the authenticated user's project role from the database.
   * Returns null if the user has no membership in the project.
   *
   * The project creator is treated as OWNER. Records in `project_members`
   * determine ADMIN vs MEMBER — the role column defaults to 'MEMBER' on
   * insert. An explicit 'OWNER' row supersedes the creator check.
   */
  async getProjectRole(projectId: string, userId: string): Promise<ProjectRole | null> {
    // Check project_members table (includes owner rows too)
    const memberRow = await db
      .selectFrom('project_members')
      .where('project_id', '=', projectId)
      .where('user_id', '=', userId)
      .select(['role'])
      .executeTakeFirst();

    if (memberRow) {
      return memberRow.role as ProjectRole;
    }

    // Fall back: the creator gets OWNER role even before an explicit row exists
    const project = await db
      .selectFrom('projects')
      .where('id', '=', projectId)
      .select(['created_by'])
      .executeTakeFirst();

    if (!project) return null;
    if (project.created_by === userId) return 'OWNER';

    return null;
  }

  /**
   * Asserts that `userId` has the given `permission` in `projectId`.
   * Throws ForbiddenException (403) or NotFoundException (404) as appropriate.
   *
   * Returns the resolved membership so callers can inspect the role if needed.
   */
  async requireProjectPermission(
    projectId: string,
    userId: string,
    permission: Permission,
  ): Promise<ProjectMembership> {
    const { membership } = await this.requireProjectPermissionWithProject(
      projectId,
      userId,
      permission,
    );
    return membership;
  }

  /**
   * Like `requireProjectPermission` but also returns the full project row from
   * the SAME query that resolves the role. Callers that need the project (e.g.
   * for its `key` when formatting work-item identifiers) should prefer this
   * over chaining `requireProjectPermission` + a separate project lookup.
   *
   * Resolves the role via a single LEFT JOIN on `project_members`, so worst
   * case previously (3 queries: project existence + member row + creator
   * fallback) collapses to 1 round-trip.
   */
  async requireProjectPermissionWithProject(
    projectId: string,
    userId: string,
    permission: Permission,
  ): Promise<{ project: ProjectRow; membership: ProjectMembership }> {
    const row = await db
      .selectFrom('projects as p')
      .leftJoin('project_members as pm', (jb) =>
        jb.onRef('pm.project_id', '=', 'p.id').on('pm.user_id', '=', userId),
      )
      .where('p.id', '=', projectId)
      .select([
        'p.id',
        'p.organization_id',
        'p.name',
        'p.description',
        'p.key',
        'p.created_by',
        'p.archived',
        'p.next_work_item_seq',
        'p.created_at',
        'p.updated_at',
        'pm.role as member_role',
      ])
      .executeTakeFirst();

    if (!row) {
      throw new NotFoundException('Project not found');
    }

    const role: ProjectRole | null =
      (row.member_role as ProjectRole | null) ??
      (row.created_by === userId ? 'OWNER' : null);

    if (!role || !hasPermission(role, permission)) {
      throw new ForbiddenException(
        `You do not have permission to perform this action (required: ${permission})`,
      );
    }

    // Strip the joined-in role column so the returned project matches a raw row.
    const { member_role: _member_role, ...project } = row;

    return { project, membership: { projectId, userId, role } };
  }

  /**
   * Asserts that `userId` is a member of `projectId` (any role).
   * Use this for read-only operations where all members have access.
   */
  async requireProjectMember(projectId: string, userId: string): Promise<ProjectMembership> {
    return this.requireProjectPermission(projectId, userId, Permission.PROJECT_VIEW);
  }

  /**
   * Asserts that the work item identified by `workItemId` belongs to
   * `projectId`. This prevents cross-project work item access where
   * a user crafts a request with a valid item ID from a different project.
   *
   * Returns the work item row so callers don't need a second DB query.
   */
  async requireWorkItemInProject(workItemId: string, projectId: string) {
    const item = await db
      .selectFrom('work_items')
      .where('id', '=', workItemId)
      .where('project_id', '=', projectId)
      .selectAll()
      .executeTakeFirst();

    if (!item) {
      // Return generic 404 — don't leak existence of items in other projects
      throw new NotFoundException('Work item not found');
    }

    return item;
  }

  /**
   * Asserts that a work item's project ID matches `expectedProjectId`.
   * Used when the project is derived from the item (not from the URL).
   */
  async assertWorkItemBelongsToProject(itemProjectId: string, expectedProjectId: string): Promise<void> {
    if (itemProjectId !== expectedProjectId) {
      throw new ForbiddenException('Work item does not belong to this project');
    }
  }

  /**
   * Asserts that `userId` has the given `permission` in `projectId`.
   * Alias matching standard requirement signature.
   */
  async requirePermission(
    userId: string,
    projectId: string,
    permission: Permission,
  ): Promise<ProjectMembership> {
    return this.requireProjectPermission(projectId, userId, permission);
  }

  /**
   * Asserts that `userId` has access to `projectId` AND belongs to `teamId`.
   * Also verifies `teamId` belongs to `projectId`.
   */
  async requireTeamAccess(
    userId: string,
    projectId: string,
    teamId: string,
  ): Promise<{ teamId: string; userId: string; role: 'ADMIN' | 'MEMBER' }> {
    await this.requireProjectPermission(projectId, userId, Permission.TEAM_VIEW);

    const team = await db
      .selectFrom('teams')
      .where('id', '=', teamId)
      .where('project_id', '=', projectId)
      .select(['id', 'project_id'])
      .executeTakeFirst();

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const member = await db
      .selectFrom('team_members')
      .where('team_id', '=', teamId)
      .where('user_id', '=', userId)
      .select(['team_id', 'user_id', 'role'])
      .executeTakeFirst();

    if (!member) {
      throw new ForbiddenException('You do not belong to this team');
    }

    return {
      teamId: member.team_id,
      userId: member.user_id,
      role: member.role as 'ADMIN' | 'MEMBER',
    };
  }

  /**
   * Serialises the user's permissions for a project to the frontend.
   * This enables UX gating without an extra round-trip per action.
   */
  async getProjectPermissions(projectId: string, userId: string): Promise<{
    role: ProjectRole | null;
    permissions: Permission[];
  }> {
    const role = await this.getProjectRole(projectId, userId);
    if (!role) return { role: null, permissions: [] };
    return { role, permissions: getPermissionsForRole(role) };
  }
}
