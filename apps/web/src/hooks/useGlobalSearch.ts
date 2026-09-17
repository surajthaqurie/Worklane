import { fetchWithAuth } from "./fetcher";
import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type GlobalSearchResult = {
  id: string;
  key: string;
  projectId: string;
  project: { id: string; key: string; name: string };
  type: 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
  title: string;
  state: string;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedToAvatar: string | null;
  updatedAt: string;
};

export type GlobalSearchResponse = {
  items: GlobalSearchResult[];
  total: number;
};

export type GlobalSearchParams = {
  q?: string;
  projectId?: string;
  type?: string;
  state?: string;
  assignedTo?: string;
  tags?: string;
  limit?: number;
  offset?: number;
};

export function useGlobalSearch(
  params: GlobalSearchParams,
  options?: { enabled?: boolean },
) {
  return useQuery<GlobalSearchResponse>({
    queryKey: ['global-search', 'work-items', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.q) searchParams.set('q', params.q);
      if (params.projectId) searchParams.set('projectId', params.projectId);
      if (params.type) searchParams.set('type', params.type);
      if (params.state) searchParams.set('state', params.state);
      if (params.assignedTo) searchParams.set('assignedTo', params.assignedTo);
      if (params.tags) searchParams.set('tags', params.tags);
      if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
      searchParams.set('offset', String(params.offset ?? 0));

      const res = await fetchWithAuth(
        `${API_URL}/search/work-items?${searchParams.toString()}`,
      );
      if (!res.ok) throw new Error('Failed to search work items');
      return res.json();
    },
    enabled: options?.enabled ?? true,
  });
}