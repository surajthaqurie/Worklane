export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface CreateOrganizationDto {
  name: string;
  description?: string;
}

export interface UpdateOrganizationDto {
  name?: string;
  description?: string;
}

export interface AddOrganizationMemberDto {
  userId?: string;
  email?: string;
  role?: OrganizationRole;
}

export interface UpdateOrganizationMemberRoleDto {
  role: OrganizationRole;
}

export interface OrganizationDto {
  id: string;
  name: string;
  description: string | null;
  role?: OrganizationRole | null;
  memberCount: number;
  projectCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface OrganizationMemberDto {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}
