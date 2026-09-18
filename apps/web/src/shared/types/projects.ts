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

export interface ProjectOverviewStats {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  bugs: number;
}

export interface ProjectOverviewIteration {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  state: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  completedItems: number;
  remainingItems: number;
  totalItems: number;
  progress: number;
}

export interface ProjectOverviewActivity {
  id: string;
  user_name: string;
  action: string;
  work_item_seq: number | string;
  work_item_title: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface ProjectOverview {
  stats: ProjectOverviewStats;
  activeIteration: ProjectOverviewIteration | null;
  recentActivity: ProjectOverviewActivity[];
}
