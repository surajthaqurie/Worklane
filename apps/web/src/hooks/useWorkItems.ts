import { fetchWithAuth } from "./fetcher";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useWorkItems(projectId: string, filters: Record<string, string> = {}, teamId?: string | null) {
  return useQuery({
    queryKey: ['projects', projectId, 'work-items', filters, teamId ?? null],
    queryFn: async () => {
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
      
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/work-items?${searchParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch work items');
      return res.json();
    }
  });
}

export function useWorkItemChildren(projectId: string, parentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['projects', projectId, 'work-items', { parentId }],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('parentId', parentId);
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/work-items?${searchParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch children work items');
      return res.json();
    },
    enabled: options?.enabled
  });
}

export function useBoardWorkItems(projectId: string, boardId: string, filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['projects', projectId, 'boards', boardId, 'work-items', filters],
    queryFn: async () => {
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
      
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/boards/${boardId}/work-items?${searchParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch board work items');
      return res.json();
    }
  });
}

export function useCreateWorkItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/work-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create work item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
    }
  });
}

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

export function useUpdateWorkItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetchWithAuth(`${API_URL}/work-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update work item');
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['projects', projectId] });
      const previousQueries = queryClient.getQueriesData({ queryKey: ['projects', projectId] });
      queryClient.setQueriesData({ queryKey: ['projects', projectId] }, (old: unknown) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((item: WorkItem) => (item.id === id ? { ...item, ...data } : item));
      });
      return { previousQueries };
    },
    onError: (_err, _newTodo, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    }
  });
}

export function useTransitionWorkItemState(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, state }: { id: string; state: string }) => {
      const res = await fetchWithAuth(`${API_URL}/work-items/${id}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update work item state');
      }
      return res.json();
    },
    onMutate: async ({ id, state }) => {
      await queryClient.cancelQueries({ queryKey: ['projects', projectId] });
      const previousQueries = queryClient.getQueriesData({ queryKey: ['projects', projectId] });
      queryClient.setQueriesData({ queryKey: ['projects', projectId] }, (old: unknown) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((item: WorkItem) => (item.id === id ? { ...item, state } : item));
      });
      return { previousQueries };
    },
    onError: (_err, _newTodo, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    }
  });
}

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

export function useWorkItemComments(workItemId: string | null) {
  return useQuery({
    queryKey: ['work-items', workItemId, 'comments'],
    queryFn: async () => {
      if (!workItemId) return [];
      const res = await fetchWithAuth(`${API_URL}/work-items/${workItemId}/comments`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      return res.json();
    },
    enabled: !!workItemId
  });
}

export function useAddComment(workItemId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      if (!workItemId) throw new Error('No work item id');
      const res = await fetchWithAuth(`${API_URL}/work-items/${workItemId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'activity'] });
    }
  });
}

export function useUpdateComment(workItemId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string, content: string }) => {
      if (!workItemId) throw new Error('No work item id');
      const res = await fetchWithAuth(`${API_URL}/work-items/${workItemId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error('Failed to update comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'activity'] });
    }
  });
}

export function useDeleteComment(workItemId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!workItemId) throw new Error('No work item id');
      const res = await fetchWithAuth(`${API_URL}/work-items/${workItemId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'activity'] });
    }
  });
}

export function useWorkItemActivity(workItemId: string | null) {
  return useQuery<WorkItemActivity[]>({
    queryKey: ['work-items', workItemId, 'activity'],
    queryFn: async () => {
      if (!workItemId) return [];
      const res = await fetchWithAuth(`${API_URL}/work-items/${workItemId}/activity`);
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    enabled: !!workItemId
  });
}

export function useDeleteWorkItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(`${API_URL}/work-items/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete work item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
    }
  });
}
