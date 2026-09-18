import { describe, it, expect } from 'vitest';
import { Permission, hasPermission, getPermissionsForRole } from './permissions.js';

describe('Permissions Logic', () => {
  it('OWNER role should have all permissions', () => {
    for (const perm of Object.values(Permission)) {
      expect(hasPermission('OWNER', perm)).toBe(true);
    }
  });

  it('all roles have all permissions during all-permissions mode', () => {
    for (const perm of Object.values(Permission)) {
      expect(hasPermission('ADMIN', perm)).toBe(true);
      expect(hasPermission('MEMBER', perm)).toBe(true);
    }
  });

  it('getPermissionsForRole returns full list for all roles', () => {
    const ownerPerms = getPermissionsForRole('OWNER');
    const adminPerms = getPermissionsForRole('ADMIN');
    const memberPerms = getPermissionsForRole('MEMBER');

    const totalPermsCount = Object.values(Permission).length;
    expect(ownerPerms.length).toBe(totalPermsCount);
    expect(adminPerms.length).toBe(totalPermsCount);
    expect(memberPerms.length).toBe(totalPermsCount);
  });
});
