export interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  avatarUrl?: string | null;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export interface ProjectArea {
  id: string;
  project_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface ProjectTag {
  id: string;
  projectId: string;
  name: string;
}

export interface ProjectOverview {
  project: Project;
  totalWorkItems: number;
  openWorkItems: number;
  completedWorkItems: number;
  totalIterations: number;
  activeIteration: {
    id: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
  } | null;
  recentActivity: Array<{
    id: string;
    action: string;
    description: string;
    createdAt: string;
    actorName: string;
  }>;
}
