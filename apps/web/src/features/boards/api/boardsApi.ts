import { apiClient } from '@/shared/utils/apiClient';
import { BoardConfig, BoardColumn, CardFields } from '@/shared/types/boards';

export interface FilterConfig {
  backlogLevel?: 'EPIC' | 'FEATURE' | 'STORY';
  types?: string[];
  assignedTo?: string | null;
  tags?: string | null;
  search?: string | null;
  iterationId?: string | null;
  areaId?: string | null;
}

export const boardsApi = {
  getBoards: (projectId: string, teamId?: string | null) => {
    const params = new URLSearchParams();
    if (teamId) params.set('teamId', teamId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<BoardConfig[]>(`/projects/${projectId}/boards${queryString}`);
  },

  getBoard: (projectId: string, boardId: string) =>
    apiClient.get<BoardConfig>(`/projects/${projectId}/boards/${boardId}`),

  createBoard: (
    projectId: string,
    data: {
      name: string;
      description?: string;
      teamId?: string | null;
      columns?: BoardColumn[];
      cardFields?: CardFields;
      filterConfig?: FilterConfig;
    }
  ) => apiClient.post<BoardConfig>(`/projects/${projectId}/boards`, data),

  updateBoard: (
    projectId: string,
    boardId: string,
    data: Partial<Omit<BoardConfig, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>
  ) => apiClient.patch<BoardConfig>(`/projects/${projectId}/boards/${boardId}`, data),

  deleteBoard: (projectId: string, boardId: string) =>
    apiClient.delete<{ success: boolean }>(`/projects/${projectId}/boards/${boardId}`),
};
