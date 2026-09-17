import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi, TeamSettingsData } from '../api/teamsApi';
import { Team, TeamMember } from '@/shared/types/teams';

export const teamKeys = {
  all: (projectId: string) => ['projects', projectId, 'teams'] as const,
  one: (projectId: string, teamId: string) => ['projects', projectId, 'teams', teamId] as const,
  members: (projectId: string, teamId: string) => ['projects', projectId, 'teams', teamId, 'members'] as const,
  settings: (projectId: string, teamId: string) => ['projects', projectId, 'teams', teamId, 'settings'] as const,
};

export function useTeams(projectId: string) {
  return useQuery<Team[]>({
    queryKey: teamKeys.all(projectId),
    queryFn: () => teamsApi.getTeams(projectId),
    enabled: !!projectId,
  });
}

export function useCreateTeam(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) => teamsApi.createTeam(projectId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.all(projectId) }),
  });
}

export function useUpdateTeam(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, data }: { teamId: string; data: { name?: string; description?: string | null } }) =>
      teamsApi.updateTeam(projectId, teamId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.all(projectId) }),
  });
}

export function useDeleteTeam(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => teamsApi.deleteTeam(projectId, teamId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.all(projectId) }),
  });
}

export function useTeamMembers(projectId: string, teamId: string) {
  return useQuery<TeamMember[]>({
    queryKey: teamKeys.members(projectId, teamId),
    queryFn: () => teamsApi.getTeamMembers(projectId, teamId),
    enabled: !!teamId,
  });
}

export function useAddTeamMember(projectId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role?: string }) =>
      teamsApi.addTeamMember(projectId, teamId, { userId, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.members(projectId, teamId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.all(projectId) });
    },
  });
}

export function useUpdateTeamMemberRole(projectId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      teamsApi.updateTeamMemberRole(projectId, teamId, userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.members(projectId, teamId) }),
  });
}

export function useRemoveTeamMember(projectId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => teamsApi.removeTeamMember(projectId, teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.members(projectId, teamId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.all(projectId) });
    },
  });
}

export function useTeamSettings(projectId: string, teamId: string | null) {
  return useQuery<TeamSettingsData>({
    queryKey: teamKeys.settings(projectId, teamId ?? ''),
    queryFn: () => teamsApi.getTeamSettings(projectId, teamId!),
    enabled: !!teamId,
  });
}

export function useUpdateTeamSettings(projectId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TeamSettingsData) => teamsApi.updateTeamSettings(projectId, teamId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.settings(projectId, teamId) }),
  });
}
