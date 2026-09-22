/**
 * Shared types for the Delivery Plans & Timeline feature (Phase 17).
 *
 * These mirror the backend DTOs in
 * apps/api/src/modules/delivery-plans/ (repository + dto modules) and the
 * API responses of `DeliveryPlansController` / `WorkItemDependenciesController`.
 */

// ─── Delivery plans ──────────────────────────────────────────────────────────

export interface DeliveryPlan {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Total number of teams configured on the plan. */
  teamCount: number;
  /** Number of plan teams the requesting user is a member of. */
  userTeamCount: number;
}

export interface PlanTeam {
  id: string;
  name: string;
  description: string | null;
  areaIds: string[];
  iterationIds: string[];
  memberCount: number;
  /** Whether the requesting user is a member of this team. */
  isMember: boolean;
}

export interface CreateDeliveryPlanDto {
  name: string;
  description?: string | null;
  teamIds?: string[];
}

export interface UpdateDeliveryPlanDto {
  name?: string;
  description?: string | null;
  teamIds?: string[];
}

export interface SetPlanTeamsDto {
  teamIds: string[];
}

// ─── Timeline ────────────────────────────────────────────────────────────────

export type IterationStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export interface TimelineTeam {
  id: string;
  name: string;
  areaIds: string[];
  iterationIds: string[];
}

export interface TimelineIteration {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  state: IterationStatus;
}

export interface TimelineWorkItem {
  id: string;
  key: string;
  projectId: string;
  iterationId: string | null;
  areaId: string;
  seqNo: number;
  parentId: string | null;
  type: string;
  title: string;
  state: string;
  priority: string;
  points: number | null;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedToAvatar: string | null;
  startDate: string | null;
  targetDate: string | null;
  completedAt: string | null;
  isDone: boolean;
  backlogRank: number;
}

export type WorkItemLinkType = 'DEPENDS_ON' | 'RELATED';

export interface TimelineDependency {
  id: string;
  sourceWorkItemId: string;
  targetWorkItemId: string;
  linkType: WorkItemLinkType;
}

export interface DeliveryPlanTimeline {
  plan: DeliveryPlan;
  teams: TimelineTeam[];
  iterations: TimelineIteration[];
  workItems: TimelineWorkItem[];
  dependencies: TimelineDependency[];
  totalWorkItems: number;
  /** Plan teams hidden from the requesting user (no team membership). */
  hiddenTeamCount: number;
  limit: number;
  offset: number;
}

export interface TimelineQueryParams {
  teamId?: string;
  iterationId?: string;
  limit?: number;
  offset?: number;
}

// ─── Dependencies ────────────────────────────────────────────────────────────

export interface WorkItemLink {
  id: string;
  projectId: string;
  sourceWorkItemId: string;
  targetWorkItemId: string;
  linkType: WorkItemLinkType;
  createdBy: string;
  createdAt: string;
  sourceKey: string;
  targetKey: string;
}

export interface WorkItemLinksResponse {
  outgoing: WorkItemLink[];
  incoming: WorkItemLink[];
}

export interface CreateDependencyDto {
  targetWorkItemId: string;
  linkType?: WorkItemLinkType;
}