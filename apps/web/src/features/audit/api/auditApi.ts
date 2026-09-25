import { apiClient } from '@/shared/utils/apiClient';
import type { PaginatedAuditLog, AuditLogQueryParams } from '@/shared/types/audit';

export const auditApi = {
  getProjectAuditLogs: (projectId: string, params?: AuditLogQueryParams) => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.actorId) search.set('actorId', params.actorId);
    if (params?.eventType) search.set('eventType', params.eventType);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiClient.get<PaginatedAuditLog>(
      `/projects/${projectId}/audit-logs${qs ? `?${qs}` : ''}`,
    );
  },
};
