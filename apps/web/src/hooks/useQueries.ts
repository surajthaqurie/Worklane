import { fetchWithAuth } from './fetcher';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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

export type QueryClause = {
  id?: string;
  logicalOperator: 'AND' | 'OR';
  field: QueryField;
  operator: QueryOperator;
  value: string;
};

export type QueryDefinition = {
  filters: QueryClause[];
  sortBy: QueryField;
  sortOrder: 'asc' | 'desc';
  columns: QueryField[];
  limit: number;
};

export type SavedQuery = {
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
};

export const QUERY_FIELDS: Array<{ value: QueryField; label: string }> = [
  { value: 'key', label: 'ID' },
  { value: 'type', label: 'Type' },
  { value: 'title', label: 'Title' },
  { value: 'description', label: 'Description' },
  { value: 'state', label: 'State' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignedTo', label: 'Assigned To' },
  { value: 'createdBy', label: 'Created By' },
  { value: 'iterationId', label: 'Iteration' },
  { value: 'areaId', label: 'Area' },
  { value: 'parentId', label: 'Parent' },
  { value: 'tags', label: 'Tags' },
  { value: 'createdAt', label: 'Created Date' },
  { value: 'updatedAt', label: 'Updated Date' },
  { value: 'completedAt', label: 'Completed Date' },
];

export const FIELD_OPERATORS: Partial<Record<QueryField, QueryOperator[]>> = {
  key: ['equals', 'notEquals', 'contains', 'in'],
  type: ['equals', 'notEquals', 'in'],
  title: ['equals', 'contains', 'notContains'],
  description: ['equals', 'contains', 'notContains'],
  state: ['equals', 'notEquals', 'in', 'isEmpty', 'isNotEmpty'],
  priority: ['equals', 'in'],
  assignedTo: ['equals', 'notEquals', 'in', 'isEmpty', 'isNotEmpty'],
  createdBy: ['equals', 'in', 'isEmpty'],
  iterationId: ['equals', 'notEquals', 'in', 'isEmpty', 'isNotEmpty'],
  areaId: ['equals', 'notEquals', 'in', 'isEmpty', 'isNotEmpty'],
  parentId: ['equals', 'isEmpty', 'isNotEmpty'],
  tags: ['equals', 'notEquals', 'contains', 'notContains', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  createdAt: ['after', 'before', 'between', 'isEmpty', 'isNotEmpty'],
  updatedAt: ['after', 'before', 'between', 'isEmpty', 'isNotEmpty'],
  completedAt: ['after', 'before', 'between', 'isEmpty', 'isNotEmpty'],
};

export const DEFAULT_DEFINITION: QueryDefinition = {
  filters: [],
  sortBy: 'key',
  sortOrder: 'asc',
  columns: ['key', 'type', 'title', 'state', 'priority', 'assignedTo'],
  limit: 100,
};

export function useQueries(projectId: string) {
  return useQuery<SavedQuery[]>({
    queryKey: ['projects', projectId, 'queries'],
    queryFn: async () => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/queries`,
      );
      if (!res.ok) throw new Error('Failed to fetch queries');
      return res.json();
    },
  });
}

export function useRecentQueries(projectId: string) {
  return useQuery<SavedQuery[]>({
    queryKey: ['projects', projectId, 'queries', 'recent'],
    queryFn: async () => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/queries/recent`,
      );
      if (!res.ok) throw new Error('Failed to fetch recent queries');
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useRunQuery(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      definition,
    }: {
      id?: string;
      definition?: QueryDefinition;
    }) => {
      if (id) {
        const res = await fetchWithAuth(
          `${API_URL}/projects/${projectId}/queries/${id}/run`,
          { method: 'POST' },
        );
        if (!res.ok) throw new Error('Failed to run query');
        return res.json();
      }

      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/queries/run`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ definition: definition ?? DEFAULT_DEFINITION }),
        },
      );
      if (!res.ok) throw new Error('Failed to run query');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'queries', 'recent'],
      });
    },
  });
}

export function useCreateQuery(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: Partial<SavedQuery> & { name: string; definition: QueryDefinition },
    ) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/queries`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) throw new Error('Failed to create query');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'queries'],
      });
    },
  });
}

export function useUpdateQuery(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<SavedQuery>;
    }) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/queries/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) throw new Error('Failed to update query');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'queries'],
      });
    },
  });
}

export function useDeleteQuery(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/queries/${id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Failed to delete query');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'queries'],
      });
    },
  });
}