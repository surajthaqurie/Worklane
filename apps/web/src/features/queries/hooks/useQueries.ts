import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queriesApi, SavedQuery, QueryDefinition } from '../api/queriesApi';
import { useToast } from '@/shared/hooks/useToast';
import { formatApiError } from '@/shared/utils/error';

export const DEFAULT_DEFINITION: QueryDefinition = {
  filters: [],
  sortBy: 'key',
  sortOrder: 'asc',
  columns: ['key', 'type', 'title', 'state', 'priority', 'assignedTo'],
  limit: 100,
};

export function useQueries(projectId: string) {
  return useQuery<SavedQuery[]>({
    queryKey: ['projects', projectId, 'queries'],
    queryFn: () => queriesApi.getQueries(projectId),
    enabled: !!projectId,
  });
}

export function useRecentQueries(projectId: string) {
  return useQuery<SavedQuery[]>({
    queryKey: ['projects', projectId, 'queries', 'recent'],
    queryFn: () => queriesApi.getRecentQueries(projectId),
    enabled: !!projectId,
  });
}

export function useRunQuery(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, definition }: { id?: string; definition?: QueryDefinition }) =>
      queriesApi.runQuery(projectId, id, definition),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'queries', 'recent'] });
    },
    onError: (err) => {
      toast.showError('Failed to run query', formatApiError(err));
    },
  });
}

export function useCreateQuery(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: Partial<SavedQuery> & { name: string; definition: QueryDefinition }) =>
      queriesApi.createQuery(projectId, data),
    onSuccess: () => {
      toast.showSuccess('Query saved');
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'queries'] });
    },
    onError: (err) => {
      toast.showError('Failed to save query', formatApiError(err));
    },
  });
}

export function useUpdateQuery(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SavedQuery> }) =>
      queriesApi.updateQuery(projectId, id, data),
    onSuccess: () => {
      toast.showSuccess('Query updated');
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'queries'] });
    },
    onError: (err) => {
      toast.showError('Failed to update query', formatApiError(err));
    },
  });
}

export function useDeleteQuery(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => queriesApi.deleteQuery(projectId, id),
    onSuccess: () => {
      toast.showSuccess('Query deleted');
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'queries'] });
    },
    onError: (err) => {
      toast.showError('Failed to delete query', formatApiError(err));
    },
  });
}
