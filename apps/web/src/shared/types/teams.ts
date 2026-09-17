export type TeamRole = 'ADMIN' | 'MEMBER' | 'LEAD';

export interface TeamMember {
  id?: string;
  teamId?: string;
  userId: string;
  name?: string;
  userName?: string;
  email?: string;
  userEmail?: string;
  avatarUrl?: string | null;
  role: TeamRole;
  createdAt?: string;
}

export interface Team {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  areaId?: string | null;
  iterationId?: string | null;
  memberCount?: number;
  userRole?: TeamRole | null;
  createdAt: string;
  updatedAt?: string;
  members?: TeamMember[];
}

export interface TeamSettings {
  boardConfig?: Record<string, unknown>;
  backlogConfig?: Record<string, unknown>;
  defaultIterationId?: string | null;
  defaultAreaId?: string | null;
  iterations?: string[];
  areas?: string[];
}

export interface CreateTeamDto {
  name: string;
  description?: string;
  areaId?: string | null;
  iterationId?: string | null;
}

export interface UpdateTeamDto {
  name?: string;
  description?: string;
  areaId?: string | null;
  iterationId?: string | null;
}
