import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/projects`);
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    }
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/projects/${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch project');
      return res.json();
    }
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/projects/${projectId}/members`);
      if (!res.ok) throw new Error('Failed to fetch project members');
      return res.json();
    }
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create project');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] })
  });
}

export function useProjectOverview(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'overview'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/projects/${projectId}/overview`);
      if (!res.ok) throw new Error('Failed to fetch project overview');
      return res.json();
    }
  });
}
