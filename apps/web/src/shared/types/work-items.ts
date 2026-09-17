export type WorkItemType = 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
export type WorkItemPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface WorkItemState {
  id: string;
  projectId: string;
  key: string;
  name: string;
  category: 'PROPOSED' | 'IN_PROGRESS' | 'COMPLETED' | 'RESOLVED';
  order: number;
  color?: string;
}

export interface WorkItem {
  id: string;
  key: string;
  projectId: string;
  type: WorkItemType;
  title: string;
  description: string | null;
  state: string;
  priority: WorkItemPriority;
  points: number | null;
  assignedTo: string | null;
  assignedToName?: string | null;
  assignedToAvatar?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  closedAt?: string | null;
  parentId: string | null;
  hasChildren?: boolean;
  childCount?: number;
  backlogOrder?: number;
  backlogRank?: number;
  iterationId?: string | null;
  areaId: string;
  teamId?: string | null;
  tags?: string[];
}

export interface WorkItemActivity {
  id: string;
  workItemId: string;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  action: string;
  field: string | null;
  previousValue: string | null;
  newValue: string | null;
  previousLabel: string | null;
  newLabel: string | null;
  description: string;
  createdAt: string;
}

export interface WorkItemComment {
  id: string;
  workItemId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  isPending?: boolean;
}

export interface WorkItemCommentPage {
  items: WorkItemComment[];
  nextCursor: string | null;
}

export interface CreateWorkItemDto {
  title: string;
  description?: string;
  type: WorkItemType;
  priority: WorkItemPriority;
  state: string;
  points?: number | null;
  assignedTo?: string | null;
  parentId?: string | null;
  iterationId?: string | null;
  areaId?: string;
  teamId?: string | null;
  tags?: string[];
}

export interface UpdateWorkItemDto {
  title?: string;
  description?: string | null;
  state?: string;
  priority?: WorkItemPriority;
  points?: number | null;
  assignedTo?: string | null;
  parentId?: string | null;
  iterationId?: string | null;
  areaId?: string;
  teamId?: string | null;
  tags?: string[];
  backlogRank?: number;
}
