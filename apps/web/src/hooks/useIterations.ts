import { fetchWithAuth } from './fetcher';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Iteration = {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  state: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  workItemsCount?: number;
  doneWorkItemsCount?: number;
  incompleteCount?: number;
};

export type SprintWorkItem = {
  id: string;
  key: string;
  projectId: string;
  iterationId: string | null;
  seqNo: number;
  parentId: string | null;
  type: 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
  title: string;
  description: string | null;
  state: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  points: number | null;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedToAvatar: string | null;
  areaId: string;
  areaName: string | null;
  backlogRank: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

// ─── Query key helpers ───────────────────────────────────────────────────────

const iterationKeys = {
  all: (projectId: string) => ['projects', projectId, 'iterations'] as const,
  one: (projectId: string, id: string) => ['projects', projectId, 'iterations', id] as const,
  backlog: (projectId: string, id: string) =>
    ['projects', projectId, 'iterations', id, 'backlog'] as const,
};

// ─── List ─────────────────────────────────────────────────────────────────────

export function useIterations(projectId: string) {
  return useQuery<Iteration[]>({
    queryKey: iterationKeys.all(projectId),
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/iterations`);
      if (!res.ok) throw new Error('Failed to fetch iterations');
      return res.json();
    },
  });
}

// ─── Single ───────────────────────────────────────────────────────────────────

export function useIteration(projectId: string, iterationId: string) {
  return useQuery<Iteration | undefined>({
    queryKey: iterationKeys.one(projectId, iterationId),
    queryFn: async () => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/iterations/${iterationId}`,
      );
      if (!res.ok) throw new Error('Failed to fetch iteration');
      return res.json();
    },
    enabled: !!iterationId,
  });
}

// ─── Sprint backlog (enriched work items) ────────────────────────────────────

export function useSprintBacklog(
  projectId: string,
  iterationId: string,
  options?: { enabled?: boolean },
) {
  return useQuery<SprintWorkItem[]>({
    queryKey: iterationKeys.backlog(projectId, iterationId),
    queryFn: async () => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/iterations/${iterationId}/backlog`,
      );
      if (!res.ok) throw new Error('Failed to fetch sprint backlog');
      return res.json();
    },
    enabled: options?.enabled !== false && !!iterationId,
  });
}

// ─── Legacy (used by board page) ─────────────────────────────────────────────

export function useIterationWorkItems(
  projectId: string,
  iterationId: string,
  filters: Record<string, string> = {},
) {
  return useSprintBacklog(projectId, iterationId, { enabled: !!iterationId });
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function useCreateIteration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/iterations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create iteration');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: iterationKeys.all(projectId) });
    },
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function useUpdateIteration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/iterations/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update iteration');
      }
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: iterationKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: iterationKeys.one(projectId, id) });
    },
  });
}

// ─── Activate ─────────────────────────────────────────────────────────────────

export function useActivateIteration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/iterations/${id}/activate`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to activate iteration');
      }
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: iterationKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: iterationKeys.one(projectId, id) });
    },
  });
}

// ─── Complete ─────────────────────────────────────────────────────────────────

export type CompleteIterationPayload = {
  id: string;
  incompleteAction: 'MOVE_TO_NEXT' | 'MOVE_TO_BACKLOG';
  targetIterationId?: string | null;
};

export function useCompleteIteration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, incompleteAction, targetIterationId }: CompleteIterationPayload) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/iterations/${id}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ incompleteAction, targetIterationId }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to complete iteration');
      }
      return res.json() as Promise<{
        iteration: Iteration;
        movedCount: number;
        incompleteItems: { id: string; title: string; state: string }[];
      }>;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: iterationKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: iterationKeys.one(projectId, id) });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'backlog'] });
    },
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function useDeleteIteration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/iterations/${id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete iteration');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: iterationKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'overview'] });
    },
  });
}

// ─── Add / Remove work items ─────────────────────────────────────────────────

export function useAddWorkItemsToIteration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      iterationId,
      workItemIds,
    }: {
      iterationId: string;
      workItemIds: string[];
    }) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/iterations/${iterationId}/work-items`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workItemIds }),
        },
      );
      if (!res.ok) throw new Error('Failed to add work items to iteration');
      return res.json();
    },
    onSuccess: (_, { iterationId }) => {
      queryClient.invalidateQueries({ queryKey: iterationKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: iterationKeys.backlog(projectId, iterationId) });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'backlog'] });
    },
  });
}

export function useRemoveWorkItemFromIteration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      iterationId,
      workItemId,
    }: {
      iterationId: string;
      workItemId: string;
    }) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/iterations/${iterationId}/work-items/${workItemId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Failed to remove work item from iteration');
      return res.json();
    },
    onSuccess: (_, { iterationId }) => {
      queryClient.invalidateQueries({ queryKey: iterationKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: iterationKeys.backlog(projectId, iterationId) });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'backlog'] });
    },
  });
}

// ─── Bulk move ────────────────────────────────────────────────────────────────

export function useBulkMoveWorkItems(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      iterationId,
      workItemIds,
      targetIterationId,
    }: {
      iterationId: string;
      workItemIds: string[];
      targetIterationId: string | null;
    }) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/iterations/${iterationId}/work-items/bulk-move`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workItemIds, targetIterationId }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to move work items');
      }
      return res.json();
    },
    onSuccess: (_, { iterationId }) => {
      queryClient.invalidateQueries({ queryKey: iterationKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: iterationKeys.backlog(projectId, iterationId) });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'backlog'] });
    },
  });
}
