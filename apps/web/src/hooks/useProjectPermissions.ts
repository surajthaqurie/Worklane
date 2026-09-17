'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from './fetcher';
import { PermissionValue, ProjectRole } from '../config/permissions';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface ProjectPermissions {
  role: ProjectRole | null;
  permissions: PermissionValue[];
}

/**
 * Fetches and caches the current user's permissions for a given project.
 *
 * The backend derives this from the user's project_members.role — the
 * client-supplied x-user-id is the only trusted identity signal.
 *
 * Usage:
 *   const { can } = useProjectPermissions(projectId);
 *   if (can(Permission.WORK_ITEM_DELETE)) { ... }
 */
export function useProjectPermissions(projectId: string | null | undefined) {
  const { data, isLoading, error } = useQuery<ProjectPermissions>({
    queryKey: ['projects', projectId, 'my-permissions'],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/my-permissions`);
      if (!res.ok) {
        // If the user has no access at all, return empty permissions instead of throwing
        if (res.status === 403 || res.status === 404) {
          return { role: null, permissions: [] };
        }
        throw new Error('Failed to fetch project permissions');
      }
      return res.json();
    },
    enabled: !!projectId,
    // Permissions rarely change during a session — cache for 5 minutes
    staleTime: 5 * 60 * 1000,
  });

  const permissions = data?.permissions ?? [];
  const role = data?.role ?? null;

  /**
   * Returns true if the current user has the given permission.
   * Always returns false while loading to prevent flashing UI.
   */
  function can(permission: PermissionValue): boolean {
    if (isLoading || !data) return false;
    return permissions.includes(permission);
  }

  /**
   * Returns true if the current user has ALL of the given permissions.
   */
  function canAll(...perms: PermissionValue[]): boolean {
    if (isLoading || !data) return false;
    return perms.every((p) => permissions.includes(p));
  }

  /**
   * Returns true if the current user has ANY of the given permissions.
   */
  function canAny(...perms: PermissionValue[]): boolean {
    if (isLoading || !data) return false;
    return perms.some((p) => permissions.includes(p));
  }

  return {
    role,
    permissions,
    can,
    canAll,
    canAny,
    isLoading,
    error,
  };
}
