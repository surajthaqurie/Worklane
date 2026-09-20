import { apiClient } from '@/shared/utils/apiClient';
import {
  WorkItem,
  WorkItemActivity,
  WorkItemComment,
  WorkItemCommentPage,
  CreateWorkItemDto,
  UpdateWorkItemDto,
} from '@/shared/types/work-items';

export const workItemsApi = {
  getWorkItems: (projectId: string, params?: Record<string, string>) => {
    const searchParams = new URLSearchParams(params);
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient.get<WorkItem[]>(`/projects/${projectId}/work-items${queryString}`);
  },

  getWorkItemDetail: (id: string) => apiClient.get<WorkItem>(`/work-items/${id}`),

  createWorkItem: (projectId: string, data: CreateWorkItemDto) =>
    apiClient.post<WorkItem>(`/projects/${projectId}/work-items`, data),

  updateWorkItem: (id: string, data: UpdateWorkItemDto) =>
    apiClient.patch<WorkItem>(`/work-items/${id}`, data),

  transitionState: (id: string, state: string) =>
    apiClient.patch<WorkItem>(`/work-items/${id}/state`, { state }),

  deleteWorkItem: (id: string) => apiClient.delete<{ success: boolean }>(`/work-items/${id}`),

  // Activity & Comments
  getActivity: (id: string) => apiClient.get<WorkItemActivity[]>(`/work-items/${id}/activity`),

  getComments: (id: string, cursor?: string | null) => {
    const queryString = cursor ? `?cursor=${cursor}` : '';
    return apiClient.get<WorkItemCommentPage>(`/work-items/${id}/comments${queryString}`);
  },

  addComment: (id: string, content: string) =>
    apiClient.post<WorkItemComment>(`/work-items/${id}/comments`, { content }),

  updateComment: (id: string, commentId: string, content: string, version: number) =>
    apiClient.patch<WorkItemComment>(`/work-items/${id}/comments/${commentId}`, { content, version }),

  deleteComment: (id: string, commentId: string, version: number) =>
    apiClient.delete<{ success: boolean }>(`/work-items/${id}/comments/${commentId}`, {
      body: JSON.stringify({ version }),
    }),

  // Rollups & Hierarchy (Phase 12)
  getWorkItemRollup: (projectId: string, itemId: string) =>
    apiClient.get<import('@/shared/types/work-items').WorkItemRollup>(
      `/projects/${projectId}/work-items/${itemId}/rollups`,
    ),

  getBatchWorkItemRollups: (projectId: string, itemIds: string[]) => {
    const idsQuery = itemIds.length > 0 ? `?ids=${itemIds.join(',')}` : '';
    return apiClient.get<Record<string, import('@/shared/types/work-items').WorkItemRollup>>(
      `/projects/${projectId}/work-items/rollups${idsQuery}`,
    );
  },

  getWorkItemHierarchy: (projectId: string, itemId: string) =>
    apiClient.get<import('@/shared/types/work-items').WorkItemHierarchyResponse>(
      `/projects/${projectId}/work-items/${itemId}/hierarchy`,
    ),
};
