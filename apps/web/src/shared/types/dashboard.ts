import type { BurndownDto, VelocityDto } from './analytics';

export type WidgetType =
  | 'SPRINT_SUMMARY'
  | 'BURNDOWN'
  | 'VELOCITY'
  | 'MY_WORK_ITEMS'
  | 'BLOCKED_ITEMS'
  | 'ACTIVITY'
  | 'TEAM_PROGRESS';

export interface WidgetLayout {
  id: string;
  type: WidgetType;
  position: number;
  colSpan: number; // 1 | 2 | 3
  rowSpan?: number;
  visible: boolean;
  settings?: Record<string, unknown>;
}

export interface DashboardLayoutResponse {
  projectId: string | null;
  widgets: WidgetLayout[];
}

export interface SprintSummaryData {
  iteration: {
    id: string;
    name: string;
    goal: string | null;
    startDate: string;
    endDate: string;
    state: string;
  } | null;
  totalPoints: number;
  completedPoints: number;
  remainingPoints: number;
  totalItems: number;
  completedItems: number;
  inProgressItems: number;
  todoItems: number;
  daysRemaining: number;
}

export interface DashboardWorkItem {
  id: string;
  seqNo: number;
  projectKey: string;
  title: string;
  type: string;
  state: string;
  priority: string;
  points: number | null;
  updatedAt: string;
}

export interface DashboardBlockedItem {
  id: string;
  seqNo: number;
  projectKey: string;
  title: string;
  type: string;
  state: string;
  priority: string;
  blockedBy: {
    id: string;
    seqNo: number;
    projectKey: string;
    title: string;
    state: string;
  } | null;
  reason: string;
}

export interface DashboardActivityItem {
  id: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  workItemSeq: number;
  workItemTitle: string;
  userName: string;
  userAvatar?: string | null;
}

export interface DashboardTeamMemberProgress {
  userId: string;
  name: string;
  avatarUrl: string | null;
  assignedCount: number;
  inProgressCount: number;
  doneCount: number;
  totalPoints: number;
}

export interface DashboardData {
  scope: {
    projectId: string | null;
    teamId: string | null;
  };
  sprintSummary: SprintSummaryData | null;
  burndown: BurndownDto | null;
  velocity: VelocityDto | null;
  myWorkItems: DashboardWorkItem[];
  blockedItems: DashboardBlockedItem[];
  activity: DashboardActivityItem[];
  teamProgress: DashboardTeamMemberProgress[];
  generatedAt: string;
}
