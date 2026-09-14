import { fetchWithAuth } from "./fetcher";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function useSprints(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'sprints'],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/sprints`);
      if (!res.ok) throw new Error('Failed to fetch sprints');
      return res.json();
    }
  });
}

export function useSprint(projectId: string, sprintId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'sprints', sprintId],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/sprints/${sprintId}`);
      if (!res.ok) throw new Error('Failed to fetch sprint');
      return res.json();
    }
  });
}

export function useSprintWorkItems(projectId: string, sprintId: string, filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['projects', projectId, 'sprints', sprintId, 'work-items', filters],
    queryFn: async () => {
      if (!sprintId) return [];
      const searchParams = new URLSearchParams();
      searchParams.set('sprintId', sprintId);
      if (filters.state) searchParams.set('state', filters.state);
      if (filters.type) searchParams.set('type', filters.type);
      if (filters.priority) searchParams.set('priority', filters.priority);
      if (filters.assignedTo) searchParams.set('assignedTo', filters.assignedTo);
      if (filters.search) searchParams.set('search', filters.search);
      
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/work-items?${searchParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch sprint work items');
      return res.json();
    },
    enabled: !!sprintId
  });
}

export function useCreateSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/sprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create sprint');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] });
    }
  });
}

export function useUpdateSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/sprints/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update sprint');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints', variables.id] });
    }
  });
}
