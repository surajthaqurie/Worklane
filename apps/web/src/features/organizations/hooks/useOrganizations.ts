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

export function useOrganizations() {
  return useQuery<Organization[]>({
    queryKey: ['organizations'],
    queryFn: () => organizationsApi.getOrganizations(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrganization(organizationId?: string | null) {
  return useQuery<Organization>({
    queryKey: ['organizations', organizationId],
    queryFn: () => organizationsApi.getOrganization(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrgMembers(organizationId?: string | null) {
  return useQuery<OrganizationMember[]>({
    queryKey: ['organizations', organizationId, 'members'],
    queryFn: () => organizationsApi.getMembers(organizationId!),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useOrgProjects(organizationId?: string | null) {
  return useQuery<Project[]>({
    queryKey: ['organizations', organizationId, 'projects'],
    queryFn: () => organizationsApi.getProjects(organizationId!),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useMyOrgRole(organizationId?: string | null) {
  return useQuery<{ organizationId: string; userId: string; role: OrganizationRole }>({
    queryKey: ['organizations', organizationId, 'my-role'],
    queryFn: () => organizationsApi.getMyRole(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrganizationPayload) =>
      organizationsApi.createOrganization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useUpdateOrganization(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateOrganizationPayload) =>
      organizationsApi.updateOrganization(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId] });
    },
  });
}

export function useAddOrgMember(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddOrganizationMemberPayload) =>
      organizationsApi.addMember(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useUpdateOrgMemberRole(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrganizationRole }) =>
      organizationsApi.updateMemberRole(organizationId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId] });
    },
  });
}

export function useRemoveOrgMember(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => organizationsApi.removeMember(organizationId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}
