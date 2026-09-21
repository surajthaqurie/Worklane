import { useQuery, useMutation, useQueryClient, useInfiniteQuery, QueryClient } from '@tanstack/react-query';
import { workItemsApi } from '../api/workItemsApi';
import {
  WorkItem,
  WorkItemActivity,
  WorkItemCommentPage,
  CreateWorkItemDto,
  UpdateWorkItemDto,
} from '@/shared/types/work-items';
import { BacklogResponse } from '@/shared/types/backlogs';
import { SprintBoard } from '@/shared/types/boards';
import { formatApiError } from '@/shared/utils/error';
import { useToast } from '@/shared/hooks/useToast';

export function updateWorkItemInCache(
  queryClient: QueryClient,
  projectId: string,
  id: string,
  updater: (item: WorkItem) => WorkItem,
) {
  queryClient.setQueriesData({ queryKey: ['projects', projectId] }, (old: unknown) => {
    if (!old) return old;
    if (Array.isArray(old)) {
      return (old as WorkItem[]).map((item) => (item.id === id ? updater(item) : item));
    }
    if (typeof old === 'object' && old !== null) {
      const obj = old as Record<string, unknown>;
      if (Array.isArray(obj.items)) {
        return {
          ...obj,
          items: (obj.items as WorkItem[]).map((item) => (item.id === id ? updater(item) : item)),
        };
      }
      if (Array.isArray(obj.groups)) {
        const board = old as SprintBoard;
        let movedItem: WorkItem | null = null;

        const newGroups = board.groups.map((group) => {
          const matching = group.items.find((i) => i.id === id);
          if (matching) {
            movedItem = updater(matching);
          }
          return {
            ...group,
            items: group.items.filter((i) => i.id !== id),
          };
        });

        if (movedItem) {
          const targetGroupIndex = newGroups.findIndex((g) => g.state.key === (movedItem as WorkItem).state);
          if (targetGroupIndex !== -1) {
            newGroups[targetGroupIndex] = {
              ...newGroups[targetGroupIndex],
              items: [...newGroups[targetGroupIndex].items, movedItem],
            };
          }
        }
        return { ...board, groups: newGroups };
      }
    }
    return old;
  });

  queryClient.setQueryData(['work-items', id, 'detail'], (old: WorkItem | undefined) => {
    return old ? updater(old) : old;
  });
}

// A work-item mutation can touch the item lists, the backlog tree, and any
// iteration board that renders the item. Restricting invalidation to these
// scopes keeps boards config, members, areas, tags, overview, and other
// project queries from refetching on every edit.
export function invalidateWorkItemScopes(queryClient: QueryClient, projectId: string) {
  queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
  queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'backlog'] });
  queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
}

export function cancelWorkItemScopes(queryClient: QueryClient, projectId: string) {
  queryClient.cancelQueries({ queryKey: ['projects', projectId, 'work-items'] });
  queryClient.cancelQueries({ queryKey: ['projects', projectId, 'backlog'] });
  queryClient.cancelQueries({ queryKey: ['projects', projectId, 'iterations'] });
}

export interface WorkItemsQuery {
  search?: string;
  tags?: string;
  assignedTo?: string;
  types?: string;
  state?: string;
  iterationId?: string;
  areaId?: string;
  parentId?: string;
  priority?: string;
  limit?: string;
  offset?: string;
  fields?: string;
}

function buildWorkItemsParams(teamId?: string | null, filters?: WorkItemsQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (teamId) params.teamId = teamId;
  if (!filters) return params;
  const entries: Array<[string, string | undefined]> = [
    ['search', filters.search],
    ['tags', filters.tags],
    ['assignedTo', filters.assignedTo],
    ['types', filters.types],
    ['state', filters.state],
    ['iterationId', filters.iterationId],
    ['areaId', filters.areaId],
    ['parentId', filters.parentId],
    ['priority', filters.priority],
    ['limit', filters.limit],
    ['offset', filters.offset],
    ['fields', filters.fields],
  ];
  for (const [key, value] of entries) {
    if (value) params[key] = value;
  }
  return params;
}

export function useWorkItems(
  projectId: string,
  teamId?: string | null,
  filters?: WorkItemsQuery,
  options?: { enabled?: boolean },
) {
  const params = buildWorkItemsParams(teamId, filters);
  return useQuery<WorkItem[]>({
    queryKey: ['projects', projectId, 'work-items', params],
    queryFn: () => workItemsApi.getWorkItems(projectId, params),
    enabled: !!projectId && (options?.enabled ?? true),
  });
}

export function useWorkItemDetail(id: string) {
  return useQuery<WorkItem>({
    queryKey: ['work-items', id, 'detail'],
    queryFn: () => workItemsApi.getWorkItemDetail(id),
    enabled: !!id,
  });
}

export function useCreateWorkItem(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: CreateWorkItemDto) => workItemsApi.createWorkItem(projectId, data),
    onSuccess: (newItem) => {
      toast.showSuccess('Created work item', newItem.key);
      invalidateWorkItemScopes(queryClient, projectId);
    },
    onError: (err) => {
      toast.showError('Failed to create work item', formatApiError(err));
    },
  });
}

export function useUpdateWorkItem(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkItemDto }) =>
      workItemsApi.updateWorkItem(id, data),
    onMutate: async ({ id, data }) => {
      cancelWorkItemScopes(queryClient, projectId);
      await queryClient.cancelQueries({ queryKey: ['work-items', id] });

      updateWorkItemInCache(queryClient, projectId, id, (oldItem) => ({
        ...oldItem,
        ...data,
      }));
    },
    onError: (err) => {
      toast.showError('Failed to update work item', formatApiError(err));
      invalidateWorkItemScopes(queryClient, projectId);
    },
    onSettled: () => {
      invalidateWorkItemScopes(queryClient, projectId);
    },
  });
}

export function useTransitionWorkItemState(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      workItemsApi.transitionState(id, state),
    onMutate: async ({ id, state }) => {
      cancelWorkItemScopes(queryClient, projectId);

      updateWorkItemInCache(queryClient, projectId, id, (oldItem) => ({
        ...oldItem,
        state,
      }));
    },
    onError: (err) => {
      toast.showError('State transition failed', formatApiError(err));
      invalidateWorkItemScopes(queryClient, projectId);
    },
    onSettled: () => {
      invalidateWorkItemScopes(queryClient, projectId);
    },
  });
}

export function useDeleteWorkItem(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => workItemsApi.deleteWorkItem(id),
    onSuccess: (_, id) => {
      toast.showSuccess('Deleted work item');
      queryClient.setQueriesData({ queryKey: ['projects', projectId] }, (old: unknown) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return (old as WorkItem[]).filter((i) => i.id !== id);
        }
        if (typeof old === 'object' && old !== null) {
          const res = old as BacklogResponse;
          if (Array.isArray(res.items)) {
            return {
              ...res,
              items: res.items.filter((i) => i.id !== id),
              total: Math.max(0, res.total - 1),
            };
          }
        }
        return old;
      });
      invalidateWorkItemScopes(queryClient, projectId);
    },
    onError: (err) => {
      toast.showError('Failed to delete work item', formatApiError(err));
    },
  });
}

export function useWorkItemActivity(id: string) {
  return useQuery<WorkItemActivity[]>({
    queryKey: ['work-items', id, 'activity'],
    queryFn: () => workItemsApi.getActivity(id),
    enabled: !!id,
  });
}

export function useWorkItemComments(id: string) {
  return useInfiniteQuery<WorkItemCommentPage>({
    queryKey: ['work-items', id, 'comments'],
    queryFn: ({ pageParam }) => workItemsApi.getComments(id, pageParam as string | null),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!id,
  });
}

export function useAddComment(workItemId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (content: string) => workItemsApi.addComment(workItemId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'activity'] });
    },
    onError: (err) => {
      toast.showError('Failed to post comment', formatApiError(err));
    },
  });
}

export function useUpdateComment(workItemId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ commentId, content, version }: { commentId: string; content: string; version: number }) =>
      workItemsApi.updateComment(workItemId, commentId, content, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'comments'] });
    },
    onError: (err) => {
      toast.showError('Failed to update comment', formatApiError(err));
    },
  });
}

export function useDeleteComment(workItemId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ commentId, version }: { commentId: string; version: number }) =>
      workItemsApi.deleteComment(workItemId, commentId, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'comments'] });
    },
    onError: (err) => {
      toast.showError('Failed to delete comment', formatApiError(err));
    },
  });
}

// Phase 12 - Rollup & Hierarchy Hooks
export function useWorkItemRollup(projectId: string | undefined, itemId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId, 'work-items', itemId, 'rollup'],
    queryFn: () => workItemsApi.getWorkItemRollup(projectId!, itemId!),
    enabled: !!projectId && !!itemId,
  });
}

export function useBatchWorkItemRollups(projectId: string | undefined, itemIds: string[]) {
  return useQuery({
    queryKey: ['projects', projectId, 'work-items', 'batch-rollups', itemIds.sort().join(',')],
    queryFn: () => workItemsApi.getBatchWorkItemRollups(projectId!, itemIds),
    enabled: !!projectId && itemIds.length > 0,
  });
}

export function useWorkItemHierarchy(projectId: string | undefined, itemId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId, 'work-items', itemId, 'hierarchy'],
    queryFn: () => workItemsApi.getWorkItemHierarchy(projectId!, itemId!),
    enabled: !!projectId && !!itemId,
  });
}
