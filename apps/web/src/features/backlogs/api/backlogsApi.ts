import { apiClient } from '@/shared/utils/apiClient';
import { BacklogResponse, BacklogFilters } from '@/shared/types/backlogs';

export const backlogsApi = {
  getBacklogLevel: (projectId: string, filters: BacklogFilters, signal?: AbortSignal) => {
    const params = new URLSearchParams();

    if (filters.parentId === null) {
      params.set('parentId', 'null');
    } else if (filters.parentId !== undefined) {
      params.set('parentId', filters.parentId);
    }

    if (filters.search) params.set('search', filters.search);
    if (filters.type) params.set('type', filters.type);
    if (filters.state) params.set('state', filters.state);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.assignedTo) params.set('assignedTo', filters.assignedTo);
    if (filters.iterationId) params.set('iterationId', filters.iterationId);
    if (filters.areaId) params.set('areaId', filters.areaId);
    if (filters.teamId) params.set('teamId', filters.teamId);
    if (filters.limit !== undefined) params.set('limit', String(filters.limit));
    if (filters.offset !== undefined) params.set('offset', String(filters.offset));

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<BacklogResponse>(`/projects/${projectId}/backlog${queryString}`, { signal });
  },

  reorderItem: (
    projectId: string,
    payload: { id: string; parentId: string | null; newRank: number; teamId?: string | null; idempotencyKey?: string }
  ) => apiClient.post<{ success: boolean }>(`/projects/${projectId}/backlog/reorder`, payload),

  bulkAssignIteration: (
    projectId: string,
    payload: { itemIds: string[]; iterationId: string | null; teamId?: string | null; idempotencyKey?: string }
  ) => apiClient.post<{ success: boolean }>(`/projects/${projectId}/backlog/bulk-assign-iteration`, payload),
};
