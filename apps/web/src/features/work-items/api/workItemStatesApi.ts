import { apiClient } from '@/shared/utils/apiClient';
import { WorkItemState } from '@/shared/types/work-items';

export const workItemStatesApi = {
  getStates: (projectId: string) => apiClient.get<WorkItemState[]>(`/projects/${projectId}/work-item-states`),
  createState: (projectId: string, data: { name: string; color?: string; isDone?: boolean }) =>
    apiClient.post<WorkItemState>(`/projects/${projectId}/work-item-states`, data),
  updateState: (projectId: string, id: string, data: Partial<WorkItemState>) =>
    apiClient.patch<WorkItemState>(`/projects/${projectId}/work-item-states/${id}`, data),
  deleteState: (projectId: string, id: string) =>
    apiClient.delete<{ success: boolean }>(`/projects/${projectId}/work-item-states/${id}`),
  reorderStates: (projectId: string, orderedIds: string[]) =>
    apiClient.put<WorkItemState[]>(`/projects/${projectId}/work-item-states/reorder`, { orderedIds }),
};
