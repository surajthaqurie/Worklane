import { describe, it, expect } from 'vitest';
import { Permission, ProjectRole, hasPermission, getPermissionsForRole } from './permissions.js';

describe('Permissions Logic', () => {
  it('OWNER role should have all permissions including PROJECT_DELETE', () => {
    for (const perm of Object.values(Permission)) {
      expect(hasPermission('OWNER', perm)).toBe(true);
    }
    expect(hasPermission('OWNER', Permission.PROJECT_DELETE)).toBe(true);
  });

  it('ADMIN role should have elevated permissions but NOT PROJECT_DELETE', () => {
    expect(hasPermission('ADMIN', Permission.PROJECT_VIEW)).toBe(true);
    expect(hasPermission('ADMIN', Permission.PROJECT_EDIT)).toBe(true);
    expect(hasPermission('ADMIN', Permission.PROJECT_MANAGE_MEMBERS)).toBe(true);
    expect(hasPermission('ADMIN', Permission.PROJECT_MANAGE_SETTINGS)).toBe(true);
    expect(hasPermission('ADMIN', Permission.WORK_ITEM_DELETE)).toBe(true);
    expect(hasPermission('ADMIN', Permission.ITERATION_CREATE)).toBe(true);
    expect(hasPermission('ADMIN', Permission.TEAM_DELETE)).toBe(true);

    // ADMIN must NOT have PROJECT_DELETE
    expect(hasPermission('ADMIN', Permission.PROJECT_DELETE)).toBe(false);
  });

  it('MEMBER role should have work management permissions but NOT admin/deletion permissions', () => {
    // Allowed for MEMBER
    expect(hasPermission('MEMBER', Permission.PROJECT_VIEW)).toBe(true);
    expect(hasPermission('MEMBER', Permission.WORK_ITEM_VIEW)).toBe(true);
    expect(hasPermission('MEMBER', Permission.WORK_ITEM_CREATE)).toBe(true);
    expect(hasPermission('MEMBER', Permission.WORK_ITEM_EDIT)).toBe(true);
    expect(hasPermission('MEMBER', Permission.WORK_ITEM_ASSIGN)).toBe(true);
    expect(hasPermission('MEMBER', Permission.WORK_ITEM_CHANGE_STATE)).toBe(true);
    expect(hasPermission('MEMBER', Permission.ITERATION_VIEW)).toBe(true);
    expect(hasPermission('MEMBER', Permission.QUERY_VIEW)).toBe(true);
    expect(hasPermission('MEMBER', Permission.TEAM_VIEW)).toBe(true);

    // Rejected for MEMBER
    expect(hasPermission('MEMBER', Permission.PROJECT_EDIT)).toBe(false);
    expect(hasPermission('MEMBER', Permission.PROJECT_DELETE)).toBe(false);
    expect(hasPermission('MEMBER', Permission.PROJECT_MANAGE_MEMBERS)).toBe(false);
    expect(hasPermission('MEMBER', Permission.PROJECT_MANAGE_SETTINGS)).toBe(false);
    expect(hasPermission('MEMBER', Permission.WORK_ITEM_DELETE)).toBe(false);
    expect(hasPermission('MEMBER', Permission.ITERATION_CREATE)).toBe(false);
    expect(hasPermission('MEMBER', Permission.ITERATION_DELETE)).toBe(false);
    expect(hasPermission('MEMBER', Permission.TEAM_CREATE)).toBe(false);
    expect(hasPermission('MEMBER', Permission.TEAM_DELETE)).toBe(false);
  });

  it('should return false for unknown roles or invalid permissions', () => {
    expect(hasPermission('UNKNOWN_ROLE' as ProjectRole, Permission.PROJECT_VIEW)).toBe(false);
    expect(hasPermission('MEMBER', 'invalid:permission' as Permission)).toBe(false);
    expect(hasPermission(null as any, Permission.PROJECT_VIEW)).toBe(false);
    expect(hasPermission('OWNER', null as any)).toBe(false);
  });

  it('getPermissionsForRole returns appropriate permission arrays per role', () => {
    const ownerPerms = getPermissionsForRole('OWNER');
    const adminPerms = getPermissionsForRole('ADMIN');
    const memberPerms = getPermissionsForRole('MEMBER');
    const unknownPerms = getPermissionsForRole('UNKNOWN' as ProjectRole);

    expect(ownerPerms).toContain(Permission.PROJECT_DELETE);
    expect(adminPerms).not.toContain(Permission.PROJECT_DELETE);
    expect(adminPerms).toContain(Permission.WORK_ITEM_DELETE);
    expect(memberPerms).not.toContain(Permission.WORK_ITEM_DELETE);
    expect(memberPerms).toContain(Permission.WORK_ITEM_EDIT);
    expect(unknownPerms).toEqual([]);
  });
});
