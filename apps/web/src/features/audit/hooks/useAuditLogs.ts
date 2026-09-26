'use client';

import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../api/auditApi';
import type { PaginatedAuditLog, AuditLogQueryParams } from '@/shared/types/audit';

export const auditKeys = {
  list: (projectId: string, params: AuditLogQueryParams = {}) =>
    ['projects', projectId, 'audit-logs', params] as const,
};

export function useProjectAuditLogs(
  projectId: string | null | undefined,
  params: AuditLogQueryParams = {},
  enabled = true,
) {
  return useQuery<PaginatedAuditLog>({
    queryKey: auditKeys.list(projectId ?? '', params),
    queryFn: () => {
      if (!projectId) throw new Error('Project ID required');
      return auditApi.getProjectAuditLogs(projectId, params);
    },
    enabled: !!projectId && enabled,
    staleTime: 30 * 1000,
  });
}
