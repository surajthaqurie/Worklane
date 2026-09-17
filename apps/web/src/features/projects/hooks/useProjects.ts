import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api/projectsApi';
import { Project, ProjectArea, ProjectTag, ProjectMember, ProjectOverview } from '@/shared/types/projects';

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects(),
  });
}

export function useProject(projectId: string) {
  return useQuery<Project>({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.getProject(projectId),
    enabled: !!projectId,
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery<ProjectMember[]>({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectsApi.getProjectMembers(projectId),
    enabled: !!projectId,
  });
}

export function useProjectOverview(projectId: string) {
  return useQuery<ProjectOverview>({
    queryKey: ['projects', projectId, 'overview'],
    queryFn: () => projectsApi.getProjectOverview(projectId),
    enabled: !!projectId,
  });
}

export function useAreas(projectId: string) {
  return useQuery<ProjectArea[]>({
    queryKey: ['projects', projectId, 'areas'],
    queryFn: () => projectsApi.getAreas(projectId),
    enabled: !!projectId,
  });
}

export function useTags(projectId: string) {
  return useQuery<ProjectTag[]>({
    queryKey: ['projects', projectId, 'tags'],
    queryFn: () => projectsApi.getTags(projectId),
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Project>) => projectsApi.createProject(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}
