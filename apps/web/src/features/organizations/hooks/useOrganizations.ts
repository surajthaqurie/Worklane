import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '../api/organizationsApi';
import type {
  Organization,
  OrganizationMember,
  CreateOrganizationPayload,
  UpdateOrganizationPayload,
  AddOrganizationMemberPayload,
  OrganizationRole,
} from '../types';
import type { Project } from '@/shared/types/projects';

// ─── Structured query key factory ────────────────────────────────────────────

export const orgKeys = {
  /** All organizations the current user belongs to */
  list: () => ['organizations'] as const,
  /** A single organization */
  detail: (orgId: string) => ['organizations', orgId] as const,
  /** Members of an organization */
  members: (orgId: string) => ['organizations', orgId, 'members'] as const,
  /** Projects belonging to an organization */
  projects: (orgId: string) => ['organizations', orgId, 'projects'] as const,
  /** Current user's role in an organization */
  myRole: (orgId: string) => ['organizations', orgId, 'my-role'] as const,
} as const;

// ─── Query hooks ──────────────────────────────────────────────────────────────

export function useOrganizations() {
  return useQuery<Organization[]>({
    queryKey: orgKeys.list(),
    queryFn: () => organizationsApi.getOrganizations(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrganization(organizationId?: string | null) {
  return useQuery<Organization>({
    queryKey: orgKeys.detail(organizationId ?? ''),
    queryFn: () => organizationsApi.getOrganization(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrgMembers(organizationId?: string | null) {
  return useQuery<OrganizationMember[]>({
    queryKey: orgKeys.members(organizationId ?? ''),
    queryFn: () => organizationsApi.getMembers(organizationId!),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useOrgProjects(organizationId?: string | null) {
  return useQuery<Project[]>({
    queryKey: orgKeys.projects(organizationId ?? ''),
    queryFn: () => organizationsApi.getProjects(organizationId!),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useMyOrgRole(organizationId?: string | null) {
  return useQuery<{ organizationId: string; userId: string; role: OrganizationRole }>({
    queryKey: orgKeys.myRole(organizationId ?? ''),
    queryFn: () => organizationsApi.getMyRole(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrganizationPayload) =>
      organizationsApi.createOrganization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.list() });
    },
  });
}

export function useUpdateOrganization(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateOrganizationPayload) =>
      organizationsApi.updateOrganization(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.list() });
      queryClient.invalidateQueries({ queryKey: orgKeys.detail(organizationId) });
    },
  });
}

export function useAddOrgMember(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddOrganizationMemberPayload) =>
      organizationsApi.addMember(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.members(organizationId) });
      queryClient.invalidateQueries({ queryKey: orgKeys.detail(organizationId) });
      queryClient.invalidateQueries({ queryKey: orgKeys.list() });
    },
  });
}

export function useUpdateOrgMemberRole(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrganizationRole }) =>
      organizationsApi.updateMemberRole(organizationId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.members(organizationId) });
      queryClient.invalidateQueries({ queryKey: orgKeys.detail(organizationId) });
    },
  });
}

export function useRemoveOrgMember(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => organizationsApi.removeMember(organizationId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.members(organizationId) });
      queryClient.invalidateQueries({ queryKey: orgKeys.detail(organizationId) });
      queryClient.invalidateQueries({ queryKey: orgKeys.list() });
    },
  });
}
