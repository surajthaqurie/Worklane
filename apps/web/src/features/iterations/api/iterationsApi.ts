import { apiClient } from '@/shared/utils/apiClient';
import { Iteration, CreateIterationDto, UpdateIterationDto } from '@/shared/types/iterations';
import { SprintBoard } from '@/shared/types/boards';

export const iterationsApi = {
  getIterations: (projectId: string, teamId?: string | null, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (teamId) params.set('teamId', teamId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<Iteration[]>(`/projects/${projectId}/iterations${qs}`, { signal });
  },

  getIteration: (projectId: string, iterationId: string) =>
    apiClient.get<Iteration>(`/projects/${projectId}/iterations/${iterationId}`),

  createIteration: (projectId: string, data: CreateIterationDto) =>
    apiClient.post<Iteration>(`/projects/${projectId}/iterations`, data),

  updateIteration: (projectId: string, iterationId: string, data: UpdateIterationDto) =>
    apiClient.patch<Iteration>(`/projects/${projectId}/iterations/${iterationId}`, data),

  deleteIteration: (projectId: string, iterationId: string) =>
    apiClient.delete<{ success: boolean }>(`/projects/${projectId}/iterations/${iterationId}`),

  getSprintBoard: (projectId: string, iterationId: string) =>
    apiClient.get<SprintBoard>(`/projects/${projectId}/iterations/${iterationId}/board`),

  addWorkItem: (projectId: string, iterationId: string, workItemId: string) =>
    apiClient.post<{ success: boolean }>(`/projects/${projectId}/iterations/${iterationId}/work-items`, { workItemId }),

  removeWorkItem: (projectId: string, iterationId: string, workItemId: string) =>
    apiClient.delete<{ success: boolean }>(`/projects/${projectId}/iterations/${iterationId}/work-items/${workItemId}`),

  activateIteration: (projectId: string, iterationId: string) =>
    apiClient.post<Iteration>(`/projects/${projectId}/iterations/${iterationId}/activate`),

  completeIteration: (projectId: string, iterationId: string, moveRemainingToIterationId?: string | null) =>
    apiClient.post<Iteration>(`/projects/${projectId}/iterations/${iterationId}/complete`, {
      moveRemainingToIterationId,
    }),
};
