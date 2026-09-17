import { fetchWithAuth } from './fetcher';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/Toast';

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
  path?: string;
  order?: number;
  hasChildren?: boolean;
  createdAt: string;
  updatedAt: string;
  workItemsCount?: number;
  doneWorkItemsCount?: number;
  incompleteCount?: number;
};

export type WorkItemStateSummary = {
  id: string;
  projectId: string;
  key: string;
  name: string;
  color: string;
  sortOrder: number;
  isDone: boolean;
};

export type SprintBoard = {
  iteration: Iteration;
  states: WorkItemStateSummary[];
  groups: { state: WorkItemStateSummary; items: SprintWorkItem[] }[];
  total: number;
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
  closedAt: string | null;
};

// ─── Query key helpers ───────────────────────────────────────────────────────

const iterationKeys = {
  all: (projectId: string) => ['projects', projectId, 'iterations'] as const,
  one: (projectId: string, id: string) => ['projects', projectId, 'iterations', id] as const,
  board: (projectId: string, id: string) =>
    ['projects', projectId, 'iterations', id, 'board'] as const,
};

// ─── List ─────────────────────────────────────────────────────────────────────

export function useIterations(projectId: string, teamId?: string | null) {
  return useQuery<Iteration[]>({
    queryKey: ['projects', projectId, 'iterations', { teamId: teamId ?? null }],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (teamId) params.set('teamId', teamId);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/iterations${qs}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch iterations');
      return res.json();
    },
  });
}

// ─── Single ───────────────────────────────────────────────────────────────────

export function useIteration(projectId: string, iterationId: string) {
  return useQuery<Iteration | undefined>({
    queryKey: iterationKeys.one(projectId, iterationId),
    queryFn: async ({ signal }) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/iterations/${iterationId}`,
        { signal }
      );
      if (!res.ok) throw new Error('Failed to fetch iteration');
      return res.json();
    },
    enabled: !!iterationId,
  });
}

// ─── Sprint board (grouped by workflow state) ────────────────────────────────

export function useSprintBoard(projectId: string, iterationId: string, teamId?: string | null) {
  return useQuery<SprintBoard>({
    queryKey: [...iterationKeys.board(projectId, iterationId), teamId ?? null],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (teamId) params.set('teamId', teamId);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/iterations/${iterationId}/board${qs}`,
        { signal }
      );
      if (!res.ok) throw new Error('Failed to fetch sprint board');
      return res.json();
    },
    enabled: !!iterationId,
  });
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function useCreateIteration(projectId: string) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

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
    onSuccess: (it) => {
      showSuccess('Iteration created', it.name);
      queryClient.invalidateQueries({ queryKey: iterationKeys.all(projectId) });
    },
    onError: (err: Error) => {
      showError('Failed to create iteration', err.message);
    }
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function useUpdateIteration(projectId: string) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

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
      showSuccess('Iteration updated');
      queryClient.invalidateQueries({ queryKey: iterationKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: iterationKeys.one(projectId, id) });
    },
    onError: (err: Error) => {
      showError('Failed to update iteration', err.message);
    }
  });
}

// ─── Activate ─────────────────────────────────────────────────────────────────

export function useActivateIteration(projectId: string) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

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
      showSuccess('Sprint started!');
      queryClient.invalidateQueries({ queryKey: iterationKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: iterationKeys.one(projectId, id) });
      queryClient.invalidateQueries({ queryKey: iterationKeys.board(projectId, id) });
    },
    onError: (err: Error) => {
      showError('Failed to start sprint', err.message || 'Only one active sprint is allowed per project.');
    }
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
  const { showSuccess, showError } = useToast();

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
    onSuccess: (data, { id }) => {
      showSuccess('Sprint completed', `Moved ${data.movedCount ?? 0} incomplete item(s).`);
      queryClient.invalidateQueries({ queryKey: iterationKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: iterationKeys.one(projectId, id) });
      queryClient.invalidateQueries({ queryKey: iterationKeys.board(projectId, id) });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'backlog'] });
    },
    onError: (err: Error) => {
      showError('Failed to complete sprint', err.message);
    }
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function useDeleteIteration(projectId: string) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

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
      showSuccess('Iteration deleted');
      queryClient.invalidateQueries({ queryKey: iterationKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'overview'] });
    },
    onError: (err: Error) => {
      showError('Failed to delete iteration', err.message);
    }
  });
}

// ─── Remove work item ──────────────────────────────────────────────────────

export function useRemoveWorkItemFromIteration(projectId: string) {
  const queryClient = useQueryClient();
  const { showSuccess, showError, addPendingItem, removePendingItem } = useToast();

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
    onMutate: async ({ workItemId }) => {
      addPendingItem(workItemId);
      await queryClient.cancelQueries({ queryKey: ['projects', projectId] });
      const snapshots = queryClient.getQueriesData({ queryKey: ['projects', projectId] });
      return { snapshots, workItemId };
    },
    onSuccess: () => {
      showSuccess('Work item removed from iteration');
    },
    onError: (err: Error, _vars, context) => {
      if (context?.snapshots) {
        context.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
      }
      showError('Failed to remove work item', err.message);
    },
    onSettled: (_data, _err, { iterationId, workItemId }) => {
      removePendingItem(workItemId);
      queryClient.invalidateQueries({ queryKey: iterationKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: iterationKeys.board(projectId, iterationId) });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'backlog'] });
    },
  });
}
