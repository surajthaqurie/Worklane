import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api/projectsApi';
import { Project, ProjectArea, ProjectTag, ProjectMember, ProjectOverview } from '@/shared/types/projects';

// ─── Structured query key factory ────────────────────────────────────────────

export const projectKeys = {
  /** All projects (optionally scoped to an org) */
  list: (organizationId?: string) =>
    organizationId ? (['projects', { organizationId }] as const) : (['projects'] as const),
  /** A single project by ID */
  detail: (projectId: string) => ['projects', projectId] as const,
  /** Project members */
  members: (projectId: string) => ['projects', projectId, 'members'] as const,
  /** Project overview / summary */
  overview: (projectId: string) => ['projects', projectId, 'overview'] as const,
  /** Project area paths */
  areas: (projectId: string) => ['projects', projectId, 'areas'] as const,
  /** Project tags */
  tags: (projectId: string) => ['projects', projectId, 'tags'] as const,
  /** My permissions for a project */
  myPermissions: (projectId: string) => ['projects', projectId, 'my-permissions'] as const,
} as const;

// ─── Query hooks ──────────────────────────────────────────────────────────────

export function useProjects(organizationId?: string) {
  return useQuery<Project[]>({
    queryKey: projectKeys.list(organizationId),
    queryFn: () => projectsApi.getProjects(organizationId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProject(projectId: string) {
  return useQuery<Project>({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => projectsApi.getProject(projectId),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery<ProjectMember[]>({
    queryKey: projectKeys.members(projectId),
    queryFn: () => projectsApi.getProjectMembers(projectId),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProjectOverview(projectId: string) {
  return useQuery<ProjectOverview>({
    queryKey: projectKeys.overview(projectId),
    queryFn: () => projectsApi.getProjectOverview(projectId),
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });
}

export function useAreas(projectId: string) {
  return useQuery<ProjectArea[]>({
    queryKey: projectKeys.areas(projectId),
    queryFn: () => projectsApi.getAreas(projectId),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTags(projectId: string) {
  return useQuery<ProjectTag[]>({
    queryKey: projectKeys.tags(projectId),
    queryFn: () => projectsApi.getTags(projectId),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Project>) => projectsApi.createProject(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.list() }),
  });
}
