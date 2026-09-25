export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  role?: OrganizationRole | null;
  memberCount: number;
  projectCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface CreateOrganizationPayload {
  name: string;
  description?: string;
}

export interface UpdateOrganizationPayload {
  name?: string;
  description?: string;
}

export interface AddOrganizationMemberPayload {
  userId?: string;
  email?: string;
  role?: OrganizationRole;
}
