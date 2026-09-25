export interface WorkItemHistoryActor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface WorkItemHistoryItem {
  id: string;
  workItemId: string;
  action: string;
  field: string | null;
  fieldName: string;
  before: string | null;
  after: string | null;
  rawBefore: string | null;
  rawAfter: string | null;
  changedBy: WorkItemHistoryActor;
  changedAt: string;
  description: string;
}

export interface WorkItemHistoryGroup {
  groupId: string;
  changedBy: WorkItemHistoryActor;
  changedAt: string;
  summary: string;
  items: WorkItemHistoryItem[];
}

export interface PaginatedWorkItemHistory {
  items: WorkItemHistoryItem[];
  groups: WorkItemHistoryGroup[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface HistoryQueryParams {
  page?: number;
  limit?: number;
  actorId?: string;
  field?: string;
  from?: string;
  to?: string;
  order?: 'asc' | 'desc';
}
