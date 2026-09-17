import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Permission, hasPermission, getPermissionsForRole } from './permissions.js';

describe('Permissions Logic', () => {
  it('OWNER role should have all permissions', () => {
    for (const perm of Object.values(Permission)) {
      expect(hasPermission('OWNER', perm)).toBe(true);
    }
  });

  it('ADMIN role should have management permissions but not project delete', () => {
    expect(hasPermission('ADMIN', Permission.PROJECT_EDIT)).toBe(true);
    expect(hasPermission('ADMIN', Permission.PROJECT_MANAGE_MEMBERS)).toBe(true);
    expect(hasPermission('ADMIN', Permission.PROJECT_MANAGE_TEAMS)).toBe(true);
    expect(hasPermission('ADMIN', Permission.WORK_ITEM_DELETE)).toBe(true);
    expect(hasPermission('ADMIN', Permission.ITERATION_CREATE)).toBe(true);

    // ADMIN cannot delete project
    expect(hasPermission('ADMIN', Permission.PROJECT_DELETE)).toBe(false);
  });

  it('MEMBER role should have standard operational permissions but not administrative permissions', () => {
    // Standard work item operations allowed
    expect(hasPermission('MEMBER', Permission.WORK_ITEM_VIEW)).toBe(true);
    expect(hasPermission('MEMBER', Permission.WORK_ITEM_CREATE)).toBe(true);
    expect(hasPermission('MEMBER', Permission.WORK_ITEM_EDIT)).toBe(true);
    expect(hasPermission('MEMBER', Permission.WORK_ITEM_ASSIGN)).toBe(true);
    expect(hasPermission('MEMBER', Permission.WORK_ITEM_CHANGE_STATE)).toBe(true);
    expect(hasPermission('MEMBER', Permission.QUERY_VIEW)).toBe(true);
    expect(hasPermission('MEMBER', Permission.QUERY_CREATE)).toBe(true);

    // Admin operations denied for MEMBER
    expect(hasPermission('MEMBER', Permission.PROJECT_EDIT)).toBe(false);
    expect(hasPermission('MEMBER', Permission.PROJECT_DELETE)).toBe(false);
    expect(hasPermission('MEMBER', Permission.PROJECT_MANAGE_MEMBERS)).toBe(false);
    expect(hasPermission('MEMBER', Permission.PROJECT_MANAGE_TEAMS)).toBe(false);
    expect(hasPermission('MEMBER', Permission.WORK_ITEM_DELETE)).toBe(false);
    expect(hasPermission('MEMBER', Permission.ITERATION_CREATE)).toBe(false);
    expect(hasPermission('MEMBER', Permission.ITERATION_DELETE)).toBe(false);
    expect(hasPermission('MEMBER', Permission.TEAM_CREATE)).toBe(false);
    expect(hasPermission('MEMBER', Permission.TEAM_DELETE)).toBe(false);
  });

  it('getPermissionsForRole returns correct lists', () => {
    const ownerPerms = getPermissionsForRole('OWNER');
    const memberPerms = getPermissionsForRole('MEMBER');

    expect(ownerPerms.length).toBe(Object.values(Permission).length);
    expect(memberPerms.length).toBeLessThan(ownerPerms.length);
    expect(memberPerms).toContain(Permission.WORK_ITEM_CREATE);
    expect(memberPerms).not.toContain(Permission.PROJECT_DELETE);
  });
});
