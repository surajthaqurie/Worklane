'use client';

import { usePathname, useRouter, useSearchParams, useParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useWorkItemStates } from '../hooks/useWorkItemStates';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { Search } from 'lucide-react';

function WorkItemFiltersInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const projectId = (params.projectId as string) || '';

  const { data: states = [] } = useWorkItemStates(projectId);

  const currentSearch = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(currentSearch);
  const debouncedSearch = useDebounce(searchTerm, 300);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const p = new URLSearchParams(searchParams.toString());
      if (value) {
        p.set(key, value);
      } else {
        p.delete(key);
      }
      router.replace(`${pathname}?${p.toString()}`);
    },
    [searchParams, pathname, router],
  );

  useEffect(() => {
    if (debouncedSearch !== (searchParams.get('search') || '')) {
      updateParam('search', debouncedSearch || null);
    }
  }, [debouncedSearch, searchParams, updateParam]);

  const state = searchParams.get('state') || '';
  const type = searchParams.get('type') || '';
  const priority = searchParams.get('priority') || '';
  const assignedTo = searchParams.get('assignedTo') || '';

  return (
    <div className="flex flex-col gap-4 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] w-64 focus:outline-none focus:border-[var(--border-focus)] transition-colors placeholder:text-[var(--text-muted)] text-[var(--text-primary)]"
          />
        </div>

        <select
          value={type}
          onChange={(e) => updateParam('type', e.target.value)}
          className="px-3 py-1.5 text-[13px] font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]"
        >
          <option value="">Type</option>
          <option value="EPIC">Epic</option>
          <option value="FEATURE">Feature</option>
          <option value="STORY">Story</option>
          <option value="TASK">Task</option>
          <option value="BUG">Bug</option>
        </select>

        <select
          value={state}
          onChange={(e) => updateParam('state', e.target.value)}
          className="px-3 py-1.5 text-[13px] font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]"
        >
          <option value="">State</option>
          {states.map((s) => (
            <option key={s.id} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => updateParam('priority', e.target.value)}
          className="px-3 py-1.5 text-[13px] font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]"
        >
          <option value="">Priority</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>

        <select
          value={assignedTo}
          onChange={(e) => updateParam('assignedTo', e.target.value)}
          className="px-3 py-1.5 text-[13px] font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]"
        >
          <option value="">Assignee</option>
          <option value="UNASSIGNED">Unassigned</option>
          <option value="user-1">Alice Smith</option>
          <option value="user-2">Bob Jones</option>
          <option value="user-3">Charlie Brown</option>
        </select>
      </div>
    </div>
  );
}

export function WorkItemFilters() {
  return (
    <Suspense
      fallback={
        <div className="h-[34px] w-[600px] animate-pulse bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] mb-4" />
      }
    >
      <WorkItemFiltersInner />
    </Suspense>
  );
}

export function useWorkItemFilters() {
  const searchParams = useSearchParams();
  const filters: Record<string, string> = {};

  const state = searchParams.get('state');
  if (state) filters.state = state;

  const type = searchParams.get('type');
  if (type) filters.type = type;

  const priority = searchParams.get('priority');
  if (priority) filters.priority = priority;

  const assignedTo = searchParams.get('assignedTo');
  if (assignedTo) filters.assignedTo = assignedTo;

  const iterationId = searchParams.get('iterationId');
  if (iterationId) filters.iterationId = iterationId;

  const search = searchParams.get('search');
  if (search) filters.search = search;

  return filters;
}
