import { WorkItem } from './work-items';

export interface QueryFilterClause {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'is_empty' | 'is_not_empty';
  value: unknown;
}

export interface QueryItem {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  queryText: string;
  filters?: QueryFilterClause[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueryRunResult {
  items: WorkItem[];
  total: number;
}

export interface CreateQueryDto {
  name: string;
  description?: string;
  queryText: string;
  filters?: QueryFilterClause[];
}

export interface UpdateQueryDto {
  name?: string;
  description?: string | null;
  queryText?: string;
  filters?: QueryFilterClause[];
}
