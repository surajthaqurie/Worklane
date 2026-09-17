import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { Permission, ProjectRole, hasPermission, getPermissionsForRole } from './permissions.js';

export interface ProjectMembership {
  projectId: string;
  userId: string;
  role: ProjectRole;
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
    const project = await db
      .selectFrom('projects')
      .where('id', '=', projectId)
      .select(['id'])
      .executeTakeFirst();

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const role = await this.getProjectRole(projectId, userId);

    if (!role) {
      throw new ForbiddenException('You do not have access to this project');
    }

    if (!hasPermission(role, permission)) {
      throw new ForbiddenException(
        `You do not have permission to perform this action (required: ${permission})`,
      );
    }

    return { projectId, userId, role };
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
