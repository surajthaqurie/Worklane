'use client';

import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../api/auditApi';
import type { PaginatedAuditLog, AuditLogQueryParams } from '@/shared/types/audit';

export function useProjectAuditLogs(
  projectId: string | null | undefined,
  params: AuditLogQueryParams = {},
  enabled = true,
) {
  return useQuery<PaginatedAuditLog>({
    queryKey: ['projects', projectId, 'audit-logs', params],
    queryFn: () => {
      if (!projectId) throw new Error('Project ID required');
      return auditApi.getProjectAuditLogs(projectId, params);
    },
    enabled: !!projectId && enabled,
    staleTime: 30 * 1000,
  });
}
