import { fetchWithAuth } from './fetcher';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type BoardColumn = {
  id: string;
  name: string;
  mappedStates: string[];
  wipLimit?: number | null;
};

export type CardFields = {
  showType?: boolean;
  showPriority?: boolean;
  showAssignee?: boolean;
  showPoints?: boolean;
  showParent?: boolean;
  showTags?: boolean;
};

export type FilterConfig = {
  backlogLevel?: 'EPIC' | 'FEATURE' | 'STORY';
  types?: string[];
  assignedTo?: string | null;
  tags?: string | null;
  search?: string | null;
  iterationId?: string | null;
  areaId?: string | null;
};

export type BoardConfig = {
  id: string;
  projectId: string;
  teamId: string | null;
  name: string;
  description: string | null;
  isDefault: boolean;
  columns: BoardColumn[];
  cardFields: CardFields;
  filterConfig: FilterConfig;
  createdAt: string;
  updatedAt: string;
};

export function useBoards(projectId: string, teamId?: string | null) {
  return useQuery<BoardConfig[]>({
    queryKey: ['projects', projectId, 'boards', { teamId: teamId ?? null }],
    queryFn: async ({ signal }) => {
      const searchParams = new URLSearchParams();
      if (teamId) searchParams.set('teamId', teamId);
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/boards?${searchParams.toString()}`,
        { signal },
      );
      if (!res.ok) throw new Error('Failed to fetch boards');
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useBoard(projectId: string, boardId: string | null) {
  return useQuery<BoardConfig>({
    queryKey: ['projects', projectId, 'boards', boardId],
    queryFn: async ({ signal }) => {
      if (!boardId) throw new Error('No board ID');
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/boards/${boardId}`,
        { signal },
      );
      if (!res.ok) throw new Error('Failed to fetch board details');
      return res.json();
    },
    enabled: !!projectId && !!boardId,
  });
}

export function useCreateBoard(projectId: string) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      teamId?: string | null;
      columns?: BoardColumn[];
      cardFields?: CardFields;
      filterConfig?: FilterConfig;
    }) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create board');
      }
      return res.json();
    },
    onSuccess: (newBoard) => {
      showSuccess('Board created', `Created "${newBoard.name}"`);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boards'] });
    },
    onError: (err: Error) => {
      showError('Failed to create board', err.message);
    },
  });
}

export function useUpdateBoard(projectId: string) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: async ({
      boardId,
      data,
    }: {
      boardId: string;
      data: Partial<Omit<BoardConfig, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>;
    }) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/boards/${boardId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update board configuration');
      }
      return res.json();
    },
    onSuccess: (updated) => {
      showSuccess('Board configuration saved', `Updated board "${updated.name}"`);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boards'] });
    },
    onError: (err: Error) => {
      showError('Failed to update board', err.message);
    },
  });
}

export function useDeleteBoard(projectId: string) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: async (boardId: string) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/boards/${boardId}`,
        {
          method: 'DELETE',
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete board');
      }
      return res.json();
    },
    onSuccess: () => {
      showSuccess('Board deleted');
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boards'] });
    },
    onError: (err: Error) => {
      showError('Failed to delete board', err.message);
    },
  });
}
