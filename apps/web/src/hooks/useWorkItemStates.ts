import { fetchWithAuth } from './fetcher';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type WorkItemState = {
  id: string;
  projectId: string;
  name: string;
  key: string;
  color: string;
  sortOrder: number;
  isDone: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export function useWorkItemStates(projectId: string) {
  return useQuery<WorkItemState[]>({
    queryKey: ['projects', projectId, 'work-item-states'],
    queryFn: async () => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/work-item-states`
      );
      if (!res.ok) throw new Error('Failed to fetch work item states');
      return res.json();
    },
    enabled: !!projectId,
  });
}

function invalidateStates(queryClient: ReturnType<typeof useQueryClient>, projectId: string) {
  queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-item-states'] });
}

export function useCreateWorkItemState(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; color?: string; isDone?: boolean }) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/work-item-states`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create state');
      return res.json();
    },
    onSuccess: () => invalidateStates(queryClient, projectId)
  });
}

export function useUpdateWorkItemState(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WorkItemState> }) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/work-item-states/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update state');
      return res.json();
    },
    onSuccess: () => invalidateStates(queryClient, projectId)
  });
}

export function useDeleteWorkItemState(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/work-item-states/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete state');
      return res.json();
    },
    onSuccess: () => {
      invalidateStates(queryClient, projectId);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
    }
  });
}

export function useReorderWorkItemStates(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/work-item-states/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds })
      });
      if (!res.ok) throw new Error('Failed to reorder states');
      return res.json();
    },
    onSuccess: () => invalidateStates(queryClient, projectId)
  });
}