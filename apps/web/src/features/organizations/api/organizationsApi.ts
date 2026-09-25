import { apiClient } from '@/shared/utils/apiClient';
import type {
  Organization,
  OrganizationMember,
  CreateOrganizationPayload,
  UpdateOrganizationPayload,
  AddOrganizationMemberPayload,
  OrganizationRole,
} from '../types';
import type { Project } from '@/shared/types/projects';

export const organizationsApi = {
  getOrganizations: () =>
    apiClient.get<Organization[]>('/organizations'),

  getOrganization: (id: string) =>
    apiClient.get<Organization>(`/organizations/${id}`),

  createOrganization: (data: CreateOrganizationPayload) =>
    apiClient.post<Organization>('/organizations', data),

  updateOrganization: (id: string, data: UpdateOrganizationPayload) =>
    apiClient.patch<Organization>(`/organizations/${id}`, data),

  getMembers: (id: string) =>
    apiClient.get<OrganizationMember[]>(`/organizations/${id}/members`),

  addMember: (id: string, data: AddOrganizationMemberPayload) =>
    apiClient.post<OrganizationMember>(`/organizations/${id}/members`, data),

  updateMemberRole: (id: string, userId: string, role: OrganizationRole) =>
    apiClient.patch<OrganizationMember>(`/organizations/${id}/members/${userId}/role`, { role }),

  removeMember: (id: string, userId: string) =>
    apiClient.delete<{ success: boolean }>(`/organizations/${id}/members/${userId}`),

  getProjects: (id: string) =>
    apiClient.get<Project[]>(`/organizations/${id}/projects`),

  getMyRole: (id: string) =>
    apiClient.get<{ organizationId: string; userId: string; role: OrganizationRole }>(
      `/organizations/${id}/my-role`,
    ),
};
