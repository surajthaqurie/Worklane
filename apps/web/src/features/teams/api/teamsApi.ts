import { apiClient } from '@/shared/utils/apiClient';
import { Team, TeamMember } from '@/shared/types/teams';

export interface TeamSettingsData {
  boardConfig?: Record<string, unknown>;
  backlogConfig?: Record<string, unknown>;
  defaultIterationId?: string | null;
  defaultAreaId?: string | null;
  iterations?: string[];
  areas?: string[];
  iterationIds?: string[];
  areaIds?: string[];
}

export const teamsApi = {
  getTeams: (projectId: string) => apiClient.get<Team[]>(`/projects/${projectId}/teams`),
  createTeam: (projectId: string, data: { name: string; description?: string }) =>
    apiClient.post<Team>(`/projects/${projectId}/teams`, data),
  updateTeam: (projectId: string, teamId: string, data: { name?: string; description?: string | null }) =>
    apiClient.patch<Team>(`/projects/${projectId}/teams/${teamId}`, data),
  deleteTeam: (projectId: string, teamId: string) =>
    apiClient.delete<{ success: boolean }>(`/projects/${projectId}/teams/${teamId}`),
  getTeamMembers: (projectId: string, teamId: string) =>
    apiClient.get<TeamMember[]>(`/projects/${projectId}/teams/${teamId}/members`),
  addTeamMember: (projectId: string, teamId: string, data: { userId: string; role?: string }) =>
    apiClient.post<TeamMember>(`/projects/${projectId}/teams/${teamId}/members`, data),
  updateTeamMemberRole: (projectId: string, teamId: string, userId: string, role: string) =>
    apiClient.patch<TeamMember>(`/projects/${projectId}/teams/${teamId}/members/${userId}`, { role }),
  removeTeamMember: (projectId: string, teamId: string, userId: string) =>
    apiClient.delete<{ success: boolean }>(`/projects/${projectId}/teams/${teamId}/members/${userId}`),
  getTeamSettings: (projectId: string, teamId: string) =>
    apiClient.get<TeamSettingsData>(`/projects/${projectId}/teams/${teamId}/settings`),
  updateTeamSettings: (projectId: string, teamId: string, data: TeamSettingsData) =>
    apiClient.patch<TeamSettingsData>(`/projects/${projectId}/teams/${teamId}/settings`, data),
};
