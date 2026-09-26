'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/utils/apiClient';
import { PermissionValue, ProjectRole } from '../../config/permissions';
import { projectKeys } from '@/features/projects/hooks/useProjects';

export interface ProjectPermissions {
  role: ProjectRole | null;
  permissions: PermissionValue[];
}

export function useProjectPermissions(projectId: string | null | undefined) {
  const { data, isLoading, error } = useQuery<ProjectPermissions>({
    queryKey: projectId ? projectKeys.myPermissions(projectId) : ['projects', null, 'my-permissions'],
    queryFn: async () => {
      try {
        return await apiClient.get<ProjectPermissions>(`/projects/${projectId}/my-permissions`);
      } catch {
        return { role: null, permissions: [] };
      }
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });

  const permissions = data?.permissions ?? [];
  const role = data?.role ?? null;

  function can(permission: PermissionValue): boolean {
    if (isLoading || !data) return false;
    return permissions.includes(permission);
  }

  function canAll(...perms: PermissionValue[]): boolean {
    if (isLoading || !data) return false;
    return perms.every((p) => permissions.includes(p));
  }

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
