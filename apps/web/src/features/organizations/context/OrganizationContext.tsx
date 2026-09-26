'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useOrganizations, useOrganization } from '../hooks/useOrganizations';
import type { Organization, OrganizationRole } from '../types';

interface OrganizationContextValue {
  organizations: Organization[];
  activeOrg: Organization | null;
  activeOrgId: string | null;
  activeRole: OrganizationRole | null;
  isLoading: boolean;
  isUnauthorized: boolean;
  isNoOrganizations: boolean;
  switchOrganization: (orgId: string) => void;
  refreshOrganizations: () => Promise<unknown>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

const STORAGE_KEY = 'worklane:active_org_id';

export function OrganizationProvider({
  children,
  initialOrgId,
}: {
  children: React.ReactNode;
  initialOrgId?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Extract orgId from URL pathname if pattern is /orgs/[orgId]
  const orgMatch = pathname?.match(/^\/orgs\/([^/]+)/);
  const routeOrgId = orgMatch ? orgMatch[1] : undefined;

  const {
    data: organizations = [],
    isLoading: isOrgsLoading,
    refetch: refetchOrgs,
  } = useOrganizations();

  const [storedOrgId, setStoredOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const val = localStorage.getItem(STORAGE_KEY);
      if (val) setStoredOrgId(val);
    }
  }, []);

  // Effective org ID resolution:
  // 1. URL parameter if within /orgs/[orgId]
  // 2. initialOrgId prop if provided
  // 3. storedOrgId if user belongs to it
  // 4. First organization in user's organizations list
  const effectiveOrgId = useMemo(() => {
    if (routeOrgId) return routeOrgId;
    if (initialOrgId) return initialOrgId;

    if (storedOrgId && (isOrgsLoading || organizations.some((o) => o.id === storedOrgId))) {
      return storedOrgId;
    }

    if (organizations.length > 0) {
      return organizations[0].id;
    }

    return null;
  }, [routeOrgId, initialOrgId, storedOrgId, organizations, isOrgsLoading]);

  // Sync to localStorage
  useEffect(() => {
    if (effectiveOrgId && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, effectiveOrgId);
      } catch {
        // ignore localStorage errors
      }
    }
  }, [effectiveOrgId]);

  // Query specific details for the active organization
  const {
    data: activeOrgData,
    isLoading: isOrgLoading,
    error: orgError,
  } = useOrganization(effectiveOrgId);

  // Check if user is unauthorized for this org (403 Forbidden or 404 from API)
  const isUnauthorized = useMemo(() => {
    if (!orgError) return false;
    const err = orgError as { status?: number; statusCode?: number } | null;
    const status = err?.status || err?.statusCode;
    return status === 403 || status === 404;
  }, [orgError]);

  // Find org in organizations list as immediate fallback while specific query loads
  const activeOrg = useMemo(() => {
    if (activeOrgData) return activeOrgData;
    if (!effectiveOrgId) return null;
    return organizations.find((o) => o.id === effectiveOrgId) || null;
  }, [activeOrgData, effectiveOrgId, organizations]);

  const activeRole: OrganizationRole | null = useMemo(() => {
    if (activeOrg?.role) return activeOrg.role;
    return null;
  }, [activeOrg]);

  const isNoOrganizations = !isOrgsLoading && organizations.length === 0;

  const switchOrganization = useCallback(
    (newOrgId: string) => {
      try {
        localStorage.setItem(STORAGE_KEY, newOrgId);
        setStoredOrgId(newOrgId);
      } catch {
        // ignore
      }

      // If user was on an org-scoped route, update the route
      if (pathname?.startsWith('/orgs/')) {
        // e.g. /orgs/[orgId]/settings -> /orgs/[newOrgId]/settings
        const newPath = pathname.replace(/^\/orgs\/[^/]+/, `/orgs/${newOrgId}`);
        router.push(newPath);
      } else {
        router.push(`/orgs/${newOrgId}/projects`);
      }
    },
    [pathname, router],
  );

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        activeOrg,
        activeOrgId: effectiveOrgId,
        activeRole,
        isLoading: isOrgsLoading || (isOrgLoading && !activeOrg),
        isUnauthorized,
        isNoOrganizations,
        switchOrganization,
        refreshOrganizations: refetchOrgs,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

const defaultOrgContext: OrganizationContextValue = {
  organizations: [],
  activeOrg: null,
  activeOrgId: null,
  activeRole: null,
  isLoading: false,
  isUnauthorized: false,
  isNoOrganizations: false,
  switchOrganization: () => {},
  refreshOrganizations: async () => {},
};

export function useOrganizationContext() {
  const context = useContext(OrganizationContext);
  return context ?? defaultOrgContext;
}
