import { apiClient } from '@/shared/utils/apiClient';
import { BoardConfig, BoardColumn, CardFields, FilterConfig, SwimlaneType } from '@/shared/types/boards';
import { WorkItem } from '@/shared/types/work-items';

export type { FilterConfig } from '@/shared/types/boards';

export interface MoveWorkItemPayload {
  state: string;
  expectedVersion?: number;
  bypassWip?: boolean;
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
      swimlane?: SwimlaneType;
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

  /** WIP-aware board move. The server enforces per-column WIP limits atomically. */
  moveWorkItem: (
    projectId: string,
    boardId: string,
    workItemId: string,
    payload: MoveWorkItemPayload
  ) =>
    apiClient.post<WorkItem>(
      `/projects/${projectId}/boards/${boardId}/work-items/${workItemId}/move`,
      payload
    ),
};
