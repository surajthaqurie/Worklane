import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function useWorkItems(projectId: string, filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['projects', projectId, 'work-items', filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (filters.state) searchParams.set('state', filters.state);
      if (filters.type) searchParams.set('type', filters.type);
      if (filters.priority) searchParams.set('priority', filters.priority);
      if (filters.assignedTo) searchParams.set('assignedTo', filters.assignedTo);
      if (filters.sprintId) searchParams.set('sprintId', filters.sprintId);
      if (filters.search) searchParams.set('search', filters.search);
      
      const res = await fetch(`${API_URL}/projects/${projectId}/work-items?${searchParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch work items');
      return res.json();
    }
  });
}

export function useCreateWorkItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`${API_URL}/projects/${projectId}/work-items`, {
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
  type: 'TASK' | 'BUG' | 'STORY';
  title: string;
  description: string | null;
  state: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  parentId: string | null;
  sprintId?: string | null;
};

export function useUpdateWorkItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`${API_URL}/work-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update work item');
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['projects', projectId, 'work-items'] });
      const previousQueries = queryClient.getQueriesData({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.setQueriesData({ queryKey: ['projects', projectId, 'work-items'] }, (old: unknown) => {
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
    }
  });
}

export function useWorkItemComments(workItemId: string | null) {
  return useQuery({
    queryKey: ['work-items', workItemId, 'comments'],
    queryFn: async () => {
      if (!workItemId) return [];
      const res = await fetch(`${API_URL}/work-items/${workItemId}/comments`);
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
      const res = await fetch(`${API_URL}/work-items/${workItemId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'comments'] });
    }
  });
}

export function useUpdateComment(workItemId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string, content: string }) => {
      if (!workItemId) throw new Error('No work item id');
      const res = await fetch(`${API_URL}/work-items/${workItemId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error('Failed to update comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'comments'] });
    }
  });
}

export function useDeleteComment(workItemId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!workItemId) throw new Error('No work item id');
      const res = await fetch(`${API_URL}/work-items/${workItemId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items', workItemId, 'comments'] });
    }
  });
}

export function useWorkItemActivity(workItemId: string | null) {
  return useQuery({
    queryKey: ['work-items', workItemId, 'activity'],
    queryFn: async () => {
      if (!workItemId) return [];
      const res = await fetch(`${API_URL}/work-items/${workItemId}/activity`);
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    enabled: !!workItemId
  });
}
