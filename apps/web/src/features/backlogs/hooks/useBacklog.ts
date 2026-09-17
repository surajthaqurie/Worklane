import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backlogsApi } from '../api/backlogsApi';
import { BacklogResponse, BacklogFilters, BacklogItem } from '@/shared/types/backlogs';
import { useToast } from '@/shared/hooks/useToast';
import { formatApiError } from '@/shared/utils/error';

export const backlogKeys = {
  all: (projectId: string) => ['projects', projectId, 'backlog'] as const,
  level: (projectId: string, filters: BacklogFilters) =>
    ['projects', projectId, 'backlog', filters] as const,
};

export function useBacklogLevel(
  projectId: string,
  filters: BacklogFilters,
  options?: { enabled?: boolean }
) {
  return useQuery<BacklogResponse>({
    queryKey: backlogKeys.level(projectId, filters),
    queryFn: ({ signal }) => backlogsApi.getBacklogLevel(projectId, filters, signal),
    enabled: options?.enabled !== false,
    staleTime: 10_000,
  });
}

export function useReorderBacklogItem(projectId: string, teamId?: string | null) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (payload: { id: string; parentId: string | null; newRank: number }) =>
      backlogsApi.reorderItem(projectId, { ...payload, teamId: teamId ?? undefined }),
    onMutate: async (payload) => {
      toast.addPendingItem(payload.id);
      await queryClient.cancelQueries({ queryKey: backlogKeys.all(projectId) });

      const snapshots = queryClient.getQueriesData<BacklogResponse>({
        queryKey: backlogKeys.all(projectId),
      });

      queryClient.setQueriesData<BacklogResponse>(
        { queryKey: backlogKeys.all(projectId) },
        (old) => {
          if (!old || !Array.isArray(old.items)) return old;

          const hasItem = old.items.some((i) => i.id === payload.id);
          if (!hasItem) return old;

          const updatedItems = old.items.map((i) =>
            i.id === payload.id
              ? { ...i, backlogRank: payload.newRank, parentId: payload.parentId }
              : i
          );

          updatedItems.sort((a, b) => (a.backlogRank ?? 0) - (b.backlogRank ?? 0));

          return {
            ...old,
            items: updatedItems,
          };
        }
      );

      return { snapshots, id: payload.id };
    },
    onSuccess: () => {
      toast.showSuccess('Backlog order updated');
    },
    onError: (err, _payload, ctx) => {
      if (ctx?.snapshots) {
        ctx.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
      }
      toast.showError('Failed to reorder backlog item', `${formatApiError(err)}. Position reverted.`);
    },
    onSettled: (_data, _err, payload) => {
      toast.removePendingItem(payload.id);
      queryClient.invalidateQueries({ queryKey: backlogKeys.all(projectId) });
    },
  });
}

export function useBulkAssignIteration(projectId: string, teamId?: string | null) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (payload: { itemIds: string[]; iterationId: string | null }) =>
      backlogsApi.bulkAssignIteration(projectId, { ...payload, teamId: teamId ?? undefined }),
    onMutate: async (payload) => {
      payload.itemIds.forEach((id) => toast.addPendingItem(id));
      await queryClient.cancelQueries({ queryKey: backlogKeys.all(projectId) });

      const snapshots = queryClient.getQueriesData({ queryKey: ['projects', projectId] });

      queryClient.setQueriesData({ queryKey: ['projects', projectId] }, (old: unknown) => {
        if (!old) return old;
        if (typeof old === 'object' && old !== null) {
          const res = old as BacklogResponse;
          if (Array.isArray(res.items)) {
            return {
              ...res,
              items: res.items.map((i) =>
                payload.itemIds.includes(i.id) ? { ...i, iterationId: payload.iterationId } : i
              ),
            };
          }
        }
        if (Array.isArray(old)) {
          return (old as BacklogItem[]).map((i) =>
            payload.itemIds.includes(i.id) ? { ...i, iterationId: payload.iterationId } : i
          );
        }
        return old;
      });

      return { snapshots, itemIds: payload.itemIds };
    },
    onSuccess: (_data, payload) => {
      toast.showSuccess('Iteration assigned', `Updated ${payload.itemIds.length} item(s)`);
    },
    onError: (err, _payload, ctx) => {
      if (ctx?.snapshots) {
        ctx.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
      }
      toast.showError('Failed to assign iteration', `${formatApiError(err)}. Changes reverted.`);
    },
    onSettled: (_data, _err, payload) => {
      payload.itemIds.forEach((id) => toast.removePendingItem(id));
      queryClient.invalidateQueries({ queryKey: backlogKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
    },
  });
}
