import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { boardsApi, FilterConfig } from '../api/boardsApi';
import { BoardConfig, BoardColumn, CardFields } from '@/shared/types/boards';
import { useToast } from '@/shared/hooks/useToast';
import { formatApiError } from '@/shared/utils/error';

export function useBoards(projectId: string, teamId?: string | null) {
  return useQuery<BoardConfig[]>({
    queryKey: ['projects', projectId, 'boards', { teamId: teamId ?? null }],
    queryFn: () => boardsApi.getBoards(projectId, teamId),
    enabled: !!projectId,
  });
}

export function useBoard(projectId: string, boardId: string | null) {
  return useQuery<BoardConfig>({
    queryKey: ['projects', projectId, 'boards', boardId],
    queryFn: () => boardsApi.getBoard(projectId, boardId!),
    enabled: !!projectId && !!boardId,
  });
}

export function useCreateBoard(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      teamId?: string | null;
      columns?: BoardColumn[];
      cardFields?: CardFields;
      filterConfig?: FilterConfig;
    }) => boardsApi.createBoard(projectId, data),
    onSuccess: (newBoard) => {
      toast.showSuccess('Board created', `Created "${newBoard.name}"`);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boards'] });
    },
    onError: (err) => {
      toast.showError('Failed to create board', formatApiError(err));
    },
  });
}

export function useUpdateBoard(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({
      boardId,
      data,
    }: {
      boardId: string;
      data: Partial<Omit<BoardConfig, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>;
    }) => boardsApi.updateBoard(projectId, boardId, data),
    onSuccess: (updated) => {
      toast.showSuccess('Board configuration saved', `Updated board "${updated.name}"`);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boards'] });
    },
    onError: (err) => {
      toast.showError('Failed to update board', formatApiError(err));
    },
  });
}

export function useDeleteBoard(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (boardId: string) => boardsApi.deleteBoard(projectId, boardId),
    onSuccess: () => {
      toast.showSuccess('Board deleted');
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boards'] });
    },
    onError: (err) => {
      toast.showError('Failed to delete board', formatApiError(err));
    },
  });
}
