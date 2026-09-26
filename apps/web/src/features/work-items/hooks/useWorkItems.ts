import { useQuery, useMutation, useQueryClient, useInfiniteQuery, QueryClient } from '@tanstack/react-query';
import { workItemsApi } from '../api/workItemsApi';
import {
  WorkItem,
  WorkItemActivity,
  WorkItemCommentPage,
  CreateWorkItemDto,
  UpdateWorkItemDto,
} from '@/shared/types/work-items';
import type { PaginatedWorkItemHistory, HistoryQueryParams } from '@/shared/types/history';
import { BacklogResponse } from '@/shared/types/backlogs';
import { SprintBoard } from '@/shared/types/boards';
import { formatApiError } from '@/shared/utils/error';
import { useToast } from '@/shared/hooks/useToast';
import { ApiError } from '@/shared/types/api';
import { projectKeys } from '@/features/projects/hooks/useProjects';

// ─── Structured query key factory ────────────────────────────────────────────

export const workItemKeys = {
  /** All work-item lists under a project */
  all: (projectId: string) => ['projects', projectId, 'work-items'] as const,
  /** A filtered/parameterized list of work items */
  list: (projectId: string, params: Record<string, unknown>) =>
    ['projects', projectId, 'work-items', params] as const,
  /** Detail view for a single item */
  detail: (id: string) => ['work-items', id, 'detail'] as const,
  /** Activity feed for a single item */
  activity: (id: string) => ['work-items', id, 'activity'] as const,
  /** Change history for a single item */
  history: (id: string, params: HistoryQueryParams = {}) =>
    ['work-items', id, 'history', params] as const,
  /** Comment thread for a single item */
  comments: (id: string) => ['work-items', id, 'comments'] as const,
  /** Hierarchy info for a single item */
  hierarchy: (projectId: string, id: string) =>
    ['projects', projectId, 'work-items', id, 'hierarchy'] as const,
  /** Rollup totals for a single item */
  rollup: (projectId: string, id: string) =>
    ['projects', projectId, 'work-items', id, 'rollup'] as const,
  /** Batch rollup totals */
  batchRollups: (projectId: string, ids: string[]) =>
    ['projects', projectId, 'work-items', 'batch-rollups', [...ids].sort().join(',')] as const,
} as const;

// ─── Cache helpers ────────────────────────────────────────────────────────────

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
          const targetGroupIndex = newGroups.findIndex(
            (g) => g.state.key === (movedItem as WorkItem).state,
          );
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

  queryClient.setQueryData(workItemKeys.detail(id), (old: WorkItem | undefined) => {
    return old ? updater(old) : old;
  });
}

// A work-item mutation can touch the item lists, the backlog tree, and any
// iteration board that renders the item. Restricting invalidation to these
// scopes keeps boards config, members, areas, tags, overview, and other
// project queries from refetching on every edit.
export function invalidateWorkItemScopes(queryClient: QueryClient, projectId: string) {
  queryClient.invalidateQueries({ queryKey: workItemKeys.all(projectId) });
  queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'backlog'] });
  queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
}

export function cancelWorkItemScopes(queryClient: QueryClient, projectId: string) {
  queryClient.cancelQueries({ queryKey: workItemKeys.all(projectId) });
  queryClient.cancelQueries({ queryKey: ['projects', projectId, 'backlog'] });
  queryClient.cancelQueries({ queryKey: ['projects', projectId, 'iterations'] });
}

// ─── Query parameter builder ──────────────────────────────────────────────────

export interface WorkItemsQuery {
  search?: string;
  tags?: string;
  assignedTo?: string;
  types?: string;
  states?: string;
  /** Alias for `states` — accepted for backward-compatibility with existing callers */
  state?: string;
  priority?: string;
  areaId?: string;
  iterationId?: string;
  parentId?: string;
  /** Accepts both number and string for compatibility with existing callers */
  limit?: number | string;
  /** Accepts both number and string for compatibility with existing callers */
  offset?: number | string;
  fields?: string;
}

function buildWorkItemsParams(
  teamId?: string | null,
  filters?: WorkItemsQuery,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (teamId) params['teamId'] = teamId;
  const entries: [string, string | number | undefined][] = [
    ['search', filters?.search],
    ['tags', filters?.tags],
    ['assignedTo', filters?.assignedTo],
    ['types', filters?.types],
    // Support both 'states' and the legacy 'state' alias
    ['states', filters?.states ?? filters?.state],
    ['priority', filters?.priority],
    ['areaId', filters?.areaId],
    ['iterationId', filters?.iterationId],
    ['parentId', filters?.parentId],
    ['limit', filters?.limit],
    ['offset', filters?.offset],
    ['fields', filters?.fields],
  ];
  for (const [key, value] of entries) {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = String(value);
    }
  }
  return params;
}

// ─── Query hooks ──────────────────────────────────────────────────────────────

export function useWorkItems(
  projectId: string,
  teamId?: string | null,
  filters?: WorkItemsQuery,
  options?: { enabled?: boolean },
) {
  const params = buildWorkItemsParams(teamId, filters);
  return useQuery<WorkItem[]>({
    queryKey: workItemKeys.list(projectId, params),
    queryFn: () => workItemsApi.getWorkItems(projectId, params),
    enabled: !!projectId && (options?.enabled ?? true),
  });
}

export function useWorkItemDetail(id: string) {
  return useQuery<WorkItem>({
    queryKey: workItemKeys.detail(id),
    queryFn: () => workItemsApi.getWorkItemDetail(id),
    enabled: !!id,
  });
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

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
      if (err instanceof ApiError && err.statusCode === 403) {
        toast.showError('Permission denied', 'You no longer have permission to edit this work item.');
        queryClient.invalidateQueries({ queryKey: projectKeys.myPermissions(projectId) });
      } else {
        toast.showError('Failed to update work item', formatApiError(err));
      }
      invalidateWorkItemScopes(queryClient, projectId);
    },
    onSettled: (_data, _err, { id }) => {
      invalidateWorkItemScopes(queryClient, projectId);
      queryClient.invalidateQueries({ queryKey: workItemKeys.history(id) });
      queryClient.invalidateQueries({ queryKey: workItemKeys.activity(id) });
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
      if (err instanceof ApiError && err.statusCode === 403) {
        toast.showError('Permission denied', "You no longer have permission to change this item's state.");
        queryClient.invalidateQueries({ queryKey: projectKeys.myPermissions(projectId) });
      } else {
        toast.showError('State transition failed', formatApiError(err));
      }
      invalidateWorkItemScopes(queryClient, projectId);
    },
    onSettled: (_data, _err, { id }) => {
      invalidateWorkItemScopes(queryClient, projectId);
      queryClient.invalidateQueries({ queryKey: workItemKeys.history(id) });
      queryClient.invalidateQueries({ queryKey: workItemKeys.activity(id) });
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
      if (err instanceof ApiError && err.statusCode === 403) {
        toast.showError('Permission denied', 'You no longer have permission to delete this work item.');
        queryClient.invalidateQueries({ queryKey: projectKeys.myPermissions(projectId) });
      } else {
        toast.showError('Failed to delete work item', formatApiError(err));
      }
    },
  });
}

// ─── Activity / History / Comments ───────────────────────────────────────────

export function useWorkItemActivity(id: string) {
  return useQuery<WorkItemActivity[]>({
    queryKey: workItemKeys.activity(id),
    queryFn: () => workItemsApi.getActivity(id),
    enabled: !!id,
  });
}

export function useWorkItemHistory(
  id: string,
  params: HistoryQueryParams = {},
  enabled = true,
) {
  return useQuery<PaginatedWorkItemHistory>({
    queryKey: workItemKeys.history(id, params),
    queryFn: () => workItemsApi.getHistory(id, params),
    enabled: !!id && enabled,
    staleTime: 10 * 1000,
  });
}

export function useWorkItemComments(id: string) {
  return useInfiniteQuery<WorkItemCommentPage>({
    queryKey: workItemKeys.comments(id),
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
      queryClient.invalidateQueries({ queryKey: workItemKeys.comments(workItemId) });
      queryClient.invalidateQueries({ queryKey: workItemKeys.activity(workItemId) });
      queryClient.invalidateQueries({ queryKey: workItemKeys.history(workItemId) });
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
    mutationFn: ({
      commentId,
      content,
      version,
    }: {
      commentId: string;
      content: string;
      version: number;
    }) => workItemsApi.updateComment(workItemId, commentId, content, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workItemKeys.comments(workItemId) });
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
      queryClient.invalidateQueries({ queryKey: workItemKeys.comments(workItemId) });
    },
    onError: (err) => {
      toast.showError('Failed to delete comment', formatApiError(err));
    },
  });
}

// ─── Rollup & Hierarchy ───────────────────────────────────────────────────────

export function useWorkItemRollup(projectId: string | undefined, itemId: string | undefined) {
  return useQuery({
    queryKey: workItemKeys.rollup(projectId ?? '', itemId ?? ''),
    queryFn: () => workItemsApi.getWorkItemRollup(projectId!, itemId!),
    enabled: !!projectId && !!itemId,
  });
}

export function useBatchWorkItemRollups(projectId: string | undefined, itemIds: string[]) {
  return useQuery({
    queryKey: workItemKeys.batchRollups(projectId ?? '', itemIds),
    queryFn: () => workItemsApi.getBatchWorkItemRollups(projectId!, itemIds),
    enabled: !!projectId && itemIds.length > 0,
  });
}

export function useWorkItemHierarchy(projectId: string | undefined, itemId: string | undefined) {
  return useQuery({
    queryKey: workItemKeys.hierarchy(projectId ?? '', itemId ?? ''),
    queryFn: () => workItemsApi.getWorkItemHierarchy(projectId!, itemId!),
    enabled: !!projectId && !!itemId,
  });
}
