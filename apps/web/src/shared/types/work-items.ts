export type WorkItemType = 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
export type WorkItemPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type StateCategory = 'PROPOSED' | 'IN_PROGRESS' | 'RESOLVED' | 'COMPLETED';

export interface WorkItemState {
  id: string;
  projectId: string;
  key: string;
  name: string;
  color?: string;
  sortOrder: number;
  category: StateCategory;
  isDone: boolean;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  severity?: SeverityLevel;
  points: number | null;
  remainingWork?: number | null;
  completedWork?: number | null;
  startDate?: string | null;
  targetDate?: string | null;
  customFields?: Record<string, unknown>;
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
  version?: number;
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
  severity?: SeverityLevel;
  state?: string;
  points?: number | null;
  remainingWork?: number | null;
  completedWork?: number | null;
  startDate?: string | null;
  targetDate?: string | null;
  customFields?: Record<string, unknown>;
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
  severity?: SeverityLevel;
  points?: number | null;
  remainingWork?: number | null;
  completedWork?: number | null;
  startDate?: string | null;
  targetDate?: string | null;
  customFields?: Record<string, unknown>;
  assignedTo?: string | null;
  parentId?: string | null;
  iterationId?: string | null;
  areaId?: string;
  teamId?: string | null;
  tags?: string[];
  backlogRank?: number;
  expectedVersion?: number;
}

export interface WorkItemRollup {
  itemId: string;
  descendantCount: number;
  completedCount: number;
  totalPoints: number;
  completedPoints: number;
  remainingWork: number;
  completedWork: number;
  completionPercentage: number;
}

export interface HierarchyNode {
  id: string;
  projectId: string;
  parentId: string | null;
  type: WorkItemType;
  title: string;
  state: string;
  stateCategory: StateCategory;
  isDone: boolean;
  priority: WorkItemPriority;
  severity?: SeverityLevel;
  points: number | null;
  remainingWork: number | null;
  completedWork: number | null;
  assignedTo: string | null;
  depth: number;
  children: HierarchyNode[];
  rollup?: WorkItemRollup;
}

export interface WorkItemHierarchyResponse {
  item: HierarchyNode;
  ancestors: Array<{
    id: string;
    projectId: string;
    parentId: string | null;
    type: WorkItemType;
    title: string;
    state: string;
  }>;
  rollup: WorkItemRollup;
}

export interface WorkItemAttachment {
  id: string;
  workItemId: string;
  userId: string;
  uploaderName?: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  url: string;
  objectKey?: string;
  createdAt: string;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  objectKey: string;
  method: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface PresignedDownloadResponse {
  downloadUrl: string;
  expiresAt: string;
}
