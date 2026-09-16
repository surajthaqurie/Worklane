import { fetchWithAuth } from "./fetcher";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type Iteration = {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  state: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
  workItemsCount?: number;
  doneWorkItemsCount?: number;
};

export function useIterations(projectId: string) {
  return useQuery<Iteration[]>({
    queryKey: ['projects', projectId, 'iterations'],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/iterations`);
      if (!res.ok) throw new Error('Failed to fetch iterations');
      return res.json();
    }
  });
}

export function useIteration(projectId: string, iterationId: string) {
  return useQuery<Iteration | undefined>({
    queryKey: ['projects', projectId, 'iterations', iterationId],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/iterations/${iterationId}`);
      if (!res.ok) throw new Error('Failed to fetch iteration');
      return res.json();
    }
  });
}

export function useIterationWorkItems(projectId: string, iterationId: string, filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['projects', projectId, 'iterations', iterationId, 'work-items', filters],
    queryFn: async () => {
      if (!iterationId) return [];
      const searchParams = new URLSearchParams();
      searchParams.set('iterationId', iterationId);
      if (filters.state) searchParams.set('state', filters.state);
      if (filters.type) searchParams.set('type', filters.type);
      if (filters.priority) searchParams.set('priority', filters.priority);
      if (filters.assignedTo) searchParams.set('assignedTo', filters.assignedTo);
      if (filters.search) searchParams.set('search', filters.search);
      
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/work-items?${searchParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch iteration work items');
      return res.json();
    },
    enabled: !!iterationId
  });
}

export function useCreateIteration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/iterations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create iteration');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
    }
  });
}

export function useUpdateIteration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/iterations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update iteration');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations', variables.id] });
    }
  });
}

export function useDeleteIteration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/iterations/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete iteration');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'overview'] });
    }
  });
}

export function useRemoveWorkItemFromIteration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ iterationId, workItemId }: { iterationId: string; workItemId: string }) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/iterations/${iterationId}/work-items/${workItemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove work item from iteration');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations', variables.iterationId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'overview'] });
    }
  });
}
