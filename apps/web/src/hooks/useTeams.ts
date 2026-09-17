import { fetchWithAuth } from './fetcher';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TeamRole = 'ADMIN' | 'MEMBER';

export type Team = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
  /** The requesting user's role in this team, or null if not a member. */
  userRole: TeamRole | null;
};

export type TeamMember = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: TeamRole;
  createdAt: string;
};

export type TeamSettings = {
  boardConfig: Record<string, unknown>;
  backlogConfig: Record<string, unknown>;
  defaultIterationId: string | null;
  defaultAreaId: string | null;
  iterations: string[];
  areas: string[];
};

// ─── Query key factory ───────────────────────────────────────────────────────

export const teamKeys = {
  all: (projectId: string) => ['projects', projectId, 'teams'] as const,
  one: (projectId: string, teamId: string) =>
    ['projects', projectId, 'teams', teamId] as const,
  members: (projectId: string, teamId: string) =>
    ['projects', projectId, 'teams', teamId, 'members'] as const,
  settings: (projectId: string, teamId: string) =>
    ['projects', projectId, 'teams', teamId, 'settings'] as const,
};

// ─── Teams ───────────────────────────────────────────────────────────────────

export function useTeams(projectId: string) {
  return useQuery<Team[]>({
    queryKey: teamKeys.all(projectId),
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/teams`);
      if (!res.ok) throw new Error('Failed to fetch teams');
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useCreateTeam(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create team');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all(projectId) });
    },
  });
}

export function useUpdateTeam(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      teamId,
      data,
    }: {
      teamId: string;
      data: { name?: string; description?: string | null };
    }) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update team');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all(projectId) });
    },
  });
}

export function useDeleteTeam(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/teams/${teamId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete team');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all(projectId) });
    },
  });
}

// ─── Members ─────────────────────────────────────────────────────────────────

export function useTeamMembers(projectId: string, teamId: string) {
  return useQuery<TeamMember[]>({
    queryKey: teamKeys.members(projectId, teamId),
    queryFn: async () => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/teams/${teamId}/members`,
      );
      if (!res.ok) throw new Error('Failed to fetch team members');
      return res.json();
    },
    enabled: !!teamId,
  });
}

export function useAddTeamMember(projectId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role?: TeamRole }) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/teams/${teamId}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, role }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to add team member');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.members(projectId, teamId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.all(projectId) });
    },
  });
}

export function useUpdateTeamMemberRole(projectId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: TeamRole }) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/teams/${teamId}/members/${userId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update team member role');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.members(projectId, teamId) });
    },
  });
}

export function useRemoveTeamMember(projectId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/teams/${teamId}/members/${userId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to remove team member');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.members(projectId, teamId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.all(projectId) });
    },
  });
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function useTeamSettings(projectId: string, teamId: string | null) {
  return useQuery<TeamSettings>({
    queryKey: teamKeys.settings(projectId, teamId ?? ''),
    queryFn: async () => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/teams/${teamId}/settings`,
      );
      if (!res.ok) throw new Error('Failed to fetch team settings');
      return res.json();
    },
    enabled: !!teamId,
  });
}

export function useUpdateTeamSettings(projectId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<TeamSettings> & { iterationIds?: string[]; areaIds?: string[] }) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/teams/${teamId}/settings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update team settings');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.settings(projectId, teamId) });
    },
  });
}