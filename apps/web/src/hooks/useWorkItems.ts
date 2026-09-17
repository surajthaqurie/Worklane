import { fetchWithAuth } from "./fetcher";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery, QueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type WorkItem = {
  id: string;
  key: string;
  projectId: string;
  type: 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
  title: string;
  description: string | null;
  state: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  points: number | null;
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  closedAt: string | null;
  parentId: string | null;
  hasChildren?: boolean;
  backlogOrder?: number;
  iterationId?: string | null;
  areaId: string;
  tags?: string[];
};

export type WorkItemActivity = {
  id: string;
  workItemId: string;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  action: string;
  field: string | null;
  previousValue: string | null;
  newValue: string | null;
  previousLabel: string | null;
  newLabel: string | null;
  description: string;
  createdAt: string;
};

export type WorkItemComment = {
  id: string;
  workItemId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  isPending?: boolean;
};

export type WorkItemCommentPage = {
  items: WorkItemComment[];
  nextCursor: string | null;
};

// ─── Query Cache Helper for Optimistic Updates ──────────────────────────────

function updateWorkItemInCache(
  queryClient: QueryClient,
  projectId: string,
  id: string,
  updater: (item: any) => any,
) {
  // Update queries under project
  queryClient.setQueriesData({ queryKey: ['projects', projectId] }, (old: any) => {
    if (!old) return old;
    if (Array.isArray(old)) {
      return old.map((item) => (item.id === id ? updater(item) : item));
    }
    if (typeof old === 'object') {
      // BacklogResponse: { items: BacklogItem[], total: number }
      if (Array.isArray(old.items)) {
        return {
          ...old,
          items: old.items.map((item: any) => (item.id === id ? updater(item) : item)),
        };
      }
      // SprintBoard: { groups: [{ state, items }], states: [...] }
      if (Array.isArray(old.groups)) {
        const updatedItem = updater({ id });
        const targetState = updatedItem.state;
        
        let movedItem: any = null;
        const newGroups = old.groups.map((group: any) => {
          const matchingItem = group.items.find((i: any) => i.id === id);
          if (matchingItem) {
            movedItem = updater(matchingItem);
          }
          return {
            ...group,
            items: group.items.filter((i: any) => i.id !== id),
          };
        });

        if (movedItem) {
          const destState = targetState || movedItem.state;
          return {
            ...old,
            groups: newGroups.map((group: any) => {
              if (group.state.key === destState) {
                return { ...group, items: [...group.items, movedItem] };
              }
              return group;
            }),
          };
        }
        return { ...old, groups: newGroups };
      }
    }
    return old;
  });

  // Update single detail query
  queryClient.setQueryData(['work-items', id, 'detail'], (old: any) => {
    if (!old) return old;
    return updater(old);
  });
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useWorkItems(projectId: string, filters: Record<string, string> = {}, teamId?: string | null) {
  return useQuery({
    queryKey: ['projects', projectId, 'work-items', filters, teamId ?? null],
    queryFn: async ({ signal }) => {
      const searchParams = new URLSearchParams();
      if (filters.state) searchParams.set('state', filters.state);
      if (filters.type) searchParams.set('type', filters.type);
      if (filters.priority) searchParams.set('priority', filters.priority);
      if (filters.assignedTo) searchParams.set('assignedTo', filters.assignedTo);
      if (filters.iterationId) searchParams.set('iterationId', filters.iterationId);
      if (filters.areaId) searchParams.set('areaId', filters.areaId);
      if (filters.tags) searchParams.set('tags', filters.tags);
      if (filters.search) searchParams.set('search', filters.search);
      if (filters.parentId !== undefined) searchParams.set('parentId', filters.parentId);
      if (teamId) searchParams.set('teamId', teamId);
      
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/work-items?${searchParams.toString()}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch work items');
      return res.json();
    },
  });
}

export function useWorkItemChildren(projectId: string, parentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['projects', projectId, 'work-items', { parentId }],
    queryFn: async ({ signal }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('parentId', parentId);
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/work-items?${searchParams.toString()}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch children work items');
      return res.json();
    },
    enabled: options?.enabled
  });
}

export function useWorkItem(workItemId: string | null) {
  return useQuery<WorkItem>({
    queryKey: ['work-items', workItemId, 'detail'],
    queryFn: async ({ signal }) => {
      if (!workItemId) throw new Error('No work item id');
      const res = await fetchWithAuth(`${API_URL}/work-items/${workItemId}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch work item');
      return res.json();
    },
    enabled: !!workItemId
  });
}

export function useBoardWorkItems(projectId: string, boardId: string, filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['projects', projectId, 'boards', boardId, 'work-items', filters],
    queryFn: async ({ signal }) => {
      const searchParams = new URLSearchParams();
      if (filters.state) searchParams.set('state', filters.state);
      if (filters.type) searchParams.set('type', filters.type);
      if (filters.priority) searchParams.set('priority', filters.priority);
      if (filters.assignedTo) searchParams.set('assignedTo', filters.assignedTo);
      if (filters.iterationId) searchParams.set('iterationId', filters.iterationId);
      if (filters.areaId) searchParams.set('areaId', filters.areaId);
      if (filters.tags) searchParams.set('tags', filters.tags);
      if (filters.search) searchParams.set('search', filters.search);
      if (filters.limit) searchParams.set('limit', filters.limit);
      
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/boards/${boardId}/work-items?${searchParams.toString()}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch board work items');
      return res.json();
    }
  });
}

// ─── Mutations with Optimistic Updates & UX Feedback ────────────────────────

export function useCreateWorkItem(projectId: string) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/work-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to create work item');
      }
      return res.json();
    },
    onSuccess: (createdItem) => {
      showSuccess('Work item created', createdItem.key ? `${createdItem.key}: ${createdItem.title}` : undefined);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    },
    onError: (err: Error) => {
      showError('Failed to create work item', err.message);
    }
  });
}

export function useUpdateWorkItem(projectId: string) {
  const queryClient = useQueryClient();
  const { showSuccess, showError, addPendingItem, removePendingItem } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetchWithAuth(`${API_URL}/work-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update work item');
      }
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      addPendingItem(id);
      await queryClient.cancelQueries({ queryKey: ['projects', projectId] });
      await queryClient.cancelQueries({ queryKey: ['work-items', id] });

      const previousQueries = queryClient.getQueriesData({ queryKey: ['projects', projectId] });
      const previousDetail = queryClient.getQueryData(['work-items', id, 'detail']);

      // Optimistically update
      updateWorkItemInCache(queryClient, projectId, id, (item) => ({ ...item, ...data }));

      return { previousQueries, previousDetail, id };
    },
    onSuccess: (_data, { data }) => {
      const updatedFields = Object.keys(data).join(', ');
      showSuccess('Updated work item', updatedFields ? `Updated ${updatedFields}` : undefined);
    },
    onError: (err: Error, { id }, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(['work-items', id, 'detail'], context.previousDetail);
      }
      showError('Failed to update work item', `${err.message}. Changes reverted.`);
    },
    onSettled: (_data, _err, { id }) => {
      removePendingItem(id);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'backlog'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
      queryClient.invalidateQueries({ queryKey: ['work-items', id] });
    }
  });
}

export function useTransitionWorkItemState(projectId: string) {
  const queryClient = useQueryClient();
  const { showSuccess, showError, addPendingItem, removePendingItem } = useToast();

  return useMutation({
    mutationFn: async ({ id, state }: { id: string; state: string }) => {
      const res = await fetchWithAuth(`${API_URL}/work-items/${id}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to transition state');
      }
      return res.json();
    },
    onMutate: async ({ id, state }) => {
      addPendingItem(id);
      await queryClient.cancelQueries({ queryKey: ['projects', projectId] });
      await queryClient.cancelQueries({ queryKey: ['work-items', id] });

      const previousQueries = queryClient.getQueriesData({ queryKey: ['projects', projectId] });
      const previousDetail = queryClient.getQueryData(['work-items', id, 'detail']);

      // Optimistically transition state in cache
      updateWorkItemInCache(queryClient, projectId, id, (item) => ({ ...item, state }));

      return { previousQueries, previousDetail, id };
    },
    onSuccess: (_data, { state }) => {
      showSuccess('State updated', `Moved state to "${state}"`);
    },
    onError: (err: Error, { id }, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(['work-items', id, 'detail'], context.previousDetail);
      }
      showError('State transition failed', `${err.message}. Reverted to previous state.`);
    },
    onSettled: (_data, _err, { id }) => {
      removePendingItem(id);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'backlog'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
      queryClient.invalidateQueries({ queryKey: ['work-items', id] });
    }
  });
}

// ─── Comments & Activity ───────────────────────────────────────────────────────

export function useWorkItemComments(workItemId: string | null) {
  return useInfiniteQuery({
    queryKey: ['work-items', workItemId, 'comments'],
    queryFn: async ({ pageParam, signal }) => {
      if (!workItemId) return { items: [], nextCursor: null };
      const searchParams = new URLSearchParams();
      searchParams.set('limit', '20');
      if (pageParam) searchParams.set('cursor', pageParam);
      const res = await fetchWithAuth(
        `${API_URL}/work-items/${workItemId}/comments?${searchParams.toString()}`,
        { signal }
      );
      if (!res.ok) throw new Error('Failed to fetch comments');
      return res.json() as Promise<WorkItemCommentPage>;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: WorkItemCommentPage) =>
      lastPage.nextCursor ?? undefined,
    enabled: !!workItemId,
  });
}

export function useAddComment(workItemId: string | null) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: async (content: string) => {
      if (!workItemId) throw new Error('No work item id');
      const res = await fetchWithAuth(`${API_URL}/work-items/${workItemId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to add comment');
      }
      return res.json();
    },
    onMutate: async (content) => {
      if (!workItemId) return;
      await queryClient.cancelQueries({ queryKey: ['work-items', workItemId, 'comments'] });
      const previousComments = queryClient.getQueryData(['work-items', workItemId, 'comments']);

      const tempComment: WorkItemComment = {
        id: `temp-${Date.now()}`,
        workItemId,
        authorId: '11111111-1111-1111-1111-111111111111',
        authorName: 'Current User',
        authorAvatarUrl: null,
        content,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPending: true,
      };

      queryClient.setQueryData(['work-items', workItemId, 'comments'], (old: any) => {
        if (!old || !old.pages || old.pages.length === 0) {
          return { pages: [{ items: [tempComment], nextCursor: null }], pageParams: [undefined] };
        }
        const pages = [...old.pages];
        pages[0] = {
          ...pages[0],
          items: [tempComment, ...pages[0].items],
        };
        return { ...old, pages };
      });

      return { previousComments };
    },
    onSuccess: () => {
      showSuccess('Comment added');
    },
    onError: (err: Error, _content, context) => {
      if (context?.previousComments && workItemId) {
        queryClient.setQueryData(['work-items', workItemId, 'comments'], context.previousComments);
      }
      showError('Failed to add comment', err.message);
    },
    onSettled: () => {
      if (workItemId) {
        queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'comments'] });
        queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'activity'] });
      }
    }
  });
}

export function useUpdateComment(workItemId: string | null) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: async ({ commentId, content, version }: { commentId: string; content: string; version: number }) => {
      if (!workItemId) throw new Error('No work item id');
      const res = await fetchWithAuth(`${API_URL}/work-items/${workItemId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, version })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update comment');
      }
      return res.json();
    },
    onMutate: async ({ commentId, content }) => {
      if (!workItemId) return;
      await queryClient.cancelQueries({ queryKey: ['work-items', workItemId, 'comments'] });
      const previousComments = queryClient.getQueryData(['work-items', workItemId, 'comments']);

      queryClient.setQueryData(['work-items', workItemId, 'comments'], (old: any) => {
        if (!old || !old.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((item: WorkItemComment) =>
              item.id === commentId
                ? { ...item, content, updatedAt: new Date().toISOString(), isPending: true }
                : item,
            ),
          })),
        };
      });

      return { previousComments };
    },
    onSuccess: () => {
      showSuccess('Comment updated');
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previousComments && workItemId) {
        queryClient.setQueryData(['work-items', workItemId, 'comments'], context.previousComments);
      }
      showError('Failed to update comment', err.message);
    },
    onSettled: () => {
      if (workItemId) {
        queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'comments'] });
        queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'activity'] });
      }
    }
  });
}

export function useDeleteComment(workItemId: string | null) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: async ({ commentId, version }: { commentId: string; version: number }) => {
      if (!workItemId) throw new Error('No work item id');
      const res = await fetchWithAuth(`${API_URL}/work-items/${workItemId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to delete comment');
      }
      return res.json();
    },
    onMutate: async ({ commentId }) => {
      if (!workItemId) return;
      await queryClient.cancelQueries({ queryKey: ['work-items', workItemId, 'comments'] });
      const previousComments = queryClient.getQueryData(['work-items', workItemId, 'comments']);

      queryClient.setQueryData(['work-items', workItemId, 'comments'], (old: any) => {
        if (!old || !old.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.filter((item: WorkItemComment) => item.id !== commentId),
          })),
        };
      });

      return { previousComments };
    },
    onSuccess: () => {
      showSuccess('Comment deleted');
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previousComments && workItemId) {
        queryClient.setQueryData(['work-items', workItemId, 'comments'], context.previousComments);
      }
      showError('Failed to delete comment', err.message);
    },
    onSettled: () => {
      if (workItemId) {
        queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'comments'] });
        queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'activity'] });
      }
    }
  });
}

export function useWorkItemActivity(workItemId: string | null) {
  return useQuery<WorkItemActivity[]>({
    queryKey: ['work-items', workItemId, 'activity'],
    queryFn: async ({ signal }) => {
      if (!workItemId) return [];
      const res = await fetchWithAuth(`${API_URL}/work-items/${workItemId}/activity`, { signal });
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    enabled: !!workItemId
  });
}

export function useDeleteWorkItem(projectId: string) {
  const queryClient = useQueryClient();
  const { showSuccess, showError, addPendingItem, removePendingItem } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(`${API_URL}/work-items/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to delete work item');
      }
      return res.json();
    },
    onMutate: async (id) => {
      addPendingItem(id);
      await queryClient.cancelQueries({ queryKey: ['projects', projectId] });
      const previousQueries = queryClient.getQueriesData({ queryKey: ['projects', projectId] });

      // Optimistically remove item from cache
      queryClient.setQueriesData({ queryKey: ['projects', projectId] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) return old.filter((i) => i.id !== id);
        if (typeof old === 'object' && Array.isArray(old.items)) {
          return { ...old, items: old.items.filter((i: any) => i.id !== id), total: Math.max(0, old.total - 1) };
        }
        return old;
      });

      return { previousQueries, id };
    },
    onSuccess: () => {
      showSuccess('Work item deleted');
    },
    onError: (err: Error, id, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      showError('Failed to delete work item', err.message);
    },
    onSettled: (_data, _err, id) => {
      removePendingItem(id);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    }
  });
}
