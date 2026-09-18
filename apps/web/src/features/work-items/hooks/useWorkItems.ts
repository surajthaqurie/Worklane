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

function updateWorkItemInCache(
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

export function useWorkItems(projectId: string, teamId?: string | null) {
  return useQuery<WorkItem[]>({
    queryKey: teamId ? ['projects', projectId, 'work-items', { teamId }] : ['projects', projectId, 'work-items'],
    queryFn: () => workItemsApi.getWorkItems(projectId, teamId ? { teamId } : undefined),
    enabled: !!projectId,
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
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
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
      await queryClient.cancelQueries({ queryKey: ['projects', projectId] });
      await queryClient.cancelQueries({ queryKey: ['work-items', id] });

      updateWorkItemInCache(queryClient, projectId, id, (oldItem) => ({
        ...oldItem,
        ...data,
      }));
    },
    onError: (err) => {
      toast.showError('Failed to update work item', formatApiError(err));
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
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
      await queryClient.cancelQueries({ queryKey: ['projects', projectId] });

      updateWorkItemInCache(queryClient, projectId, id, (oldItem) => ({
        ...oldItem,
        state,
      }));
    },
    onError: (err) => {
      toast.showError('State transition failed', formatApiError(err));
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
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
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
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
