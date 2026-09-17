import { apiClient } from '@/shared/utils/apiClient';
import { WorkItem } from '@/shared/types/work-items';

export type QueryField =
  | 'key'
  | 'type'
  | 'title'
  | 'description'
  | 'state'
  | 'priority'
  | 'assignedTo'
  | 'iterationId'
  | 'areaId'
  | 'parentId'
  | 'createdBy'
  | 'createdAt'
  | 'updatedAt'
  | 'completedAt'
  | 'tags';

export type QueryOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'in'
  | 'notIn'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'after'
  | 'before'
  | 'between';

export interface QueryClause {
  id?: string;
  logicalOperator: 'AND' | 'OR';
  field: QueryField;
  operator: QueryOperator;
  value: string;
}

export interface QueryDefinition {
  filters: QueryClause[];
  sortBy: QueryField;
  sortOrder: 'asc' | 'desc';
  columns: QueryField[];
  limit: number;
}

export interface SavedQuery {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  isShared: boolean;
  createdBy: string;
  folder: string | null;
  definition: QueryDefinition;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string | null;
}

export const queriesApi = {
  getQueries: (projectId: string) => apiClient.get<SavedQuery[]>(`/projects/${projectId}/queries`),
  getRecentQueries: (projectId: string) => apiClient.get<SavedQuery[]>(`/projects/${projectId}/queries/recent`),
  runQuery: (projectId: string, id?: string, definition?: QueryDefinition) => {
    if (id) {
      return apiClient.post<{ items: WorkItem[]; total: number }>(`/projects/${projectId}/queries/${id}/run`);
    }
    return apiClient.post<{ items: WorkItem[]; total: number }>(`/projects/${projectId}/queries/run`, { definition });
  },
  createQuery: (projectId: string, data: Partial<SavedQuery> & { name: string; definition: QueryDefinition }) =>
    apiClient.post<SavedQuery>(`/projects/${projectId}/queries`, data),
  updateQuery: (projectId: string, id: string, data: Partial<SavedQuery>) =>
    apiClient.patch<SavedQuery>(`/projects/${projectId}/queries/${id}`, data),
  deleteQuery: (projectId: string, id: string) =>
    apiClient.delete<{ success: boolean }>(`/projects/${projectId}/queries/${id}`),
};
