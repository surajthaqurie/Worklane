import { fetchWithAuth } from './fetcher';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ─── Types ──────────────────────────────────────────────────────────────────

export type WorkItemType = 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
export type WorkItemPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

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

// ─── Hierarchy helpers ───────────────────────────────────────────────────────

/** The allowed parent type for each child type */
export const PARENT_TYPES: Record<WorkItemType, WorkItemType[]> = {
  EPIC: [],
  FEATURE: ['EPIC'],
  STORY: ['FEATURE'],
  TASK: ['STORY', 'BUG'],
  BUG: ['STORY'],
};

/** Default child type for each item type */
export const DEFAULT_CHILD_TYPE: Record<WorkItemType, WorkItemType | null> = {
  EPIC: 'FEATURE',
  FEATURE: 'STORY',
  STORY: 'TASK',
  TASK: null,
  BUG: null,
};

export const TYPE_LABELS: Record<WorkItemType, string> = {
  EPIC: 'Epic',
  FEATURE: 'Feature',
  STORY: 'User Story',
  TASK: 'Task',
  BUG: 'Bug',
};

export const TYPE_COLORS: Record<WorkItemType, string> = {
  EPIC: 'var(--type-epic, #8b5cf6)',
  FEATURE: 'var(--type-feature, #3b82f6)',
  STORY: 'var(--type-story, #10b981)',
  TASK: 'var(--type-task, #f59e0b)',
  BUG: 'var(--type-bug, #ef4444)',
};

export const TYPE_BG: Record<WorkItemType, string> = {
  EPIC: 'rgba(139,92,246,0.12)',
  FEATURE: 'rgba(59,130,246,0.12)',
  STORY: 'rgba(16,185,129,0.12)',
  TASK: 'rgba(245,158,11,0.12)',
  BUG: 'rgba(239,68,68,0.12)',
};

// ─── Fractional indexing helpers ─────────────────────────────────────────────

/** Compute a rank halfway between prev and next. Normalizes if values collapse. */
export function computeRank(prevRank: number | null, nextRank: number | null): number {
  const lo = prevRank ?? 0;
  const hi = nextRank ?? lo + 2000;
  return (lo + hi) / 2;
}

// ─── Query key factory ───────────────────────────────────────────────────────

export const backlogKeys = {
  all: (projectId: string) => ['projects', projectId, 'backlog'] as const,
  level: (projectId: string, filters: BacklogFilters) =>
    ['projects', projectId, 'backlog', filters] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Fetch a single level of the backlog (top-level or children of a parent). */
export function useBacklogLevel(
  projectId: string,
  filters: BacklogFilters,
  options?: { enabled?: boolean },
) {
  return useQuery<BacklogResponse>({
    queryKey: backlogKeys.level(projectId, filters),
    queryFn: async () => {
      const params = new URLSearchParams();

      // parentId: explicit null → 'null', string → string, undefined → omit (defaults to top-level)
      if (filters.parentId === null) {
        params.set('parentId', 'null');
      } else if (filters.parentId !== undefined) {
        params.set('parentId', filters.parentId);
      }

      if (filters.search) params.set('search', filters.search);
      if (filters.type) params.set('type', filters.type);
      if (filters.state) params.set('state', filters.state);
      if (filters.priority) params.set('priority', filters.priority);
      if (filters.assignedTo) params.set('assignedTo', filters.assignedTo);
      if (filters.iterationId) params.set('iterationId', filters.iterationId);
      if (filters.areaId) params.set('areaId', filters.areaId);
      if (filters.teamId) params.set('teamId', filters.teamId);
      if (filters.limit !== undefined) params.set('limit', String(filters.limit));
      if (filters.offset !== undefined) params.set('offset', String(filters.offset));

      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/backlog?${params.toString()}`,
      );
      if (!res.ok) throw new Error('Failed to fetch backlog');
      return res.json();
    },
    enabled: options?.enabled !== false,
    staleTime: 10_000, // 10 s — backlog changes are intentional, not background-refreshed aggressively
  });
}

/** Reorder a single item in the backlog (drag-and-drop). */
export function useReorderBacklogItem(projectId: string, teamId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      parentId: string | null;
      newRank: number;
    }) => {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectId}/backlog/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, teamId: teamId ?? undefined }),
      });
      if (!res.ok) throw new Error('Failed to reorder backlog item');
      return res.json();
    },
    // Optimistic update: immediately reorder in the cache
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: backlogKeys.all(projectId) });
      const snapshots = queryClient.getQueriesData<BacklogResponse>({
        queryKey: backlogKeys.all(projectId),
      });
      return { snapshots };
    },
    onError: (_err, _payload, ctx) => {
      if (ctx?.snapshots) {
        ctx.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: backlogKeys.all(projectId) });
    },
  });
}

/** Bulk assign iteration to multiple items. */
export function useBulkAssignIteration(projectId: string, teamId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { itemIds: string[]; iterationId: string | null }) => {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectId}/backlog/bulk-assign-iteration`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, teamId: teamId ?? undefined }),
        },
      );
      if (!res.ok) throw new Error('Failed to assign iteration');
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: backlogKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-items'] });
    },
  });
}
