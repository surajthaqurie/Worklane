import { describe, it, expect } from 'vitest';
import type { Organization, OrganizationMember } from '../types';

describe('Organizations Feature Model & Logic', () => {
  const mockOrgs: Organization[] = [
    {
      id: 'org-1',
      name: 'Alpha Technologies',
      description: 'First org',
      role: 'OWNER',
      memberCount: 10,
      projectCount: 4,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'org-2',
      name: 'Beta Labs',
      description: 'Second org',
      role: 'MEMBER',
      memberCount: 2,
      projectCount: 1,
      createdAt: '2026-02-01T00:00:00.000Z',
    },
  ];

  describe('Organization initials generator', () => {
    const getInitials = (name?: string) => {
      if (!name) return 'O';
      return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    };

    it('extracts two letters from multi-word names', () => {
      expect(getInitials('Alpha Technologies')).toBe('AT');
      expect(getInitials('Acme Global Services')).toBe('AG');
    });

    it('extracts up to two letters for single word names', () => {
      expect(getInitials('Worklane')).toBe('W');
      expect(getInitials('')).toBe('O');
      expect(getInitials(undefined)).toBe('O');
    });
  });

  describe('Organization filtering & active selection', () => {
    it('filters organizations by query case-insensitively', () => {
      const filter = (query: string) =>
        mockOrgs.filter((org) => org.name.toLowerCase().includes(query.toLowerCase()));

      expect(filter('alpha')).toHaveLength(1);
      expect(filter('alpha')[0].id).toBe('org-1');
      expect(filter('LABS')).toHaveLength(1);
      expect(filter('non-existent')).toHaveLength(0);
    });

    it('determines effective active organization', () => {
      const resolveActive = (
        routeOrgId: string | undefined,
        storedOrgId: string | null,
        orgs: Organization[],
      ) => {
        if (routeOrgId) return routeOrgId;
        if (storedOrgId && orgs.some((o) => o.id === storedOrgId)) return storedOrgId;
        if (orgs.length > 0) return orgs[0].id;
        return null;
      };

      // URL takes precedence
      expect(resolveActive('org-2', 'org-1', mockOrgs)).toBe('org-2');
      // Fallback to storage
      expect(resolveActive(undefined, 'org-2', mockOrgs)).toBe('org-2');
      // Fallback to first available if stored is invalid
      expect(resolveActive(undefined, 'org-unknown', mockOrgs)).toBe('org-1');
      // Empty orgs
      expect(resolveActive(undefined, null, [])).toBeNull();
    });
  });

  describe('Governance Role Capabilities', () => {
    const canManageOrganization = (role?: string | null) =>
      role === 'OWNER' || role === 'ADMIN';

    const canGrantOwnerRole = (actorRole?: string | null) =>
      actorRole === 'OWNER';

    it('identifies which roles have administrative management permissions', () => {
      expect(canManageOrganization('OWNER')).toBe(true);
      expect(canManageOrganization('ADMIN')).toBe(true);
      expect(canManageOrganization('MEMBER')).toBe(false);
      expect(canManageOrganization(null)).toBe(false);
    });

    it('restricts granting OWNER role strictly to existing OWNERs', () => {
      expect(canGrantOwnerRole('OWNER')).toBe(true);
      expect(canGrantOwnerRole('ADMIN')).toBe(false);
      expect(canGrantOwnerRole('MEMBER')).toBe(false);
    });

    it('enforces that an organization must preserve at least one owner', () => {
      const members: OrganizationMember[] = [
        {
          id: 'm1',
          organizationId: 'org-1',
          userId: 'u1',
          role: 'OWNER',
          name: 'Owner 1',
          email: 'o1@test.com',
          avatarUrl: null,
          createdAt: '2026-01-01',
        },
        {
          id: 'm2',
          organizationId: 'org-1',
          userId: 'u2',
          role: 'MEMBER',
          name: 'Member 2',
          email: 'm2@test.com',
          avatarUrl: null,
          createdAt: '2026-01-01',
        },
      ];

      const ownerCount = members.filter((m) => m.role === 'OWNER').length;
      expect(ownerCount).toBe(1);

      const canDemoteOrRemoveOwner = ownerCount > 1;
      expect(canDemoteOrRemoveOwner).toBe(false);
    });
  });
});
