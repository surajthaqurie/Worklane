import { WorkItemType, WorkItemPriority } from './work-items';

export interface BacklogItem {
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
  assignedToName: string | null;
  assignedToAvatar: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  parentId: string | null;
  iterationId: string | null;
  areaId: string;
  backlogOrder: number;
  backlogRank: number;
  hasChildren: boolean;
  childCount: number;
  tags: string[];
}

export interface BacklogResponse {
  items: BacklogItem[];
  total: number;
}

export interface BacklogFilters {
  parentId?: string | null;
  search?: string;
  type?: string;
  state?: string;
  priority?: string;
  assignedTo?: string;
  iterationId?: string;
  areaId?: string;
  teamId?: string;
  limit?: number;
  offset?: number;
}
