import { apiClient } from '@/shared/utils/apiClient';
import { Project, ProjectMember, ProjectArea, ProjectTag, ProjectOverview } from '@/shared/types/projects';

export const projectsApi = {
  getProjects: () => apiClient.get<Project[]>('/projects'),
  getProject: (projectId: string) => apiClient.get<Project>(`/projects/${projectId}`),
  getProjectMembers: (projectId: string) => apiClient.get<ProjectMember[]>(`/projects/${projectId}/members`),
  getProjectOverview: (projectId: string) => apiClient.get<ProjectOverview>(`/projects/${projectId}/overview`),
  getAreas: (projectId: string) => apiClient.get<ProjectArea[]>(`/projects/${projectId}/areas`),
  getTags: (projectId: string) => apiClient.get<ProjectTag[]>(`/projects/${projectId}/tags`),
  createProject: (data: Partial<Project>) => apiClient.post<Project>('/projects', data),
};
