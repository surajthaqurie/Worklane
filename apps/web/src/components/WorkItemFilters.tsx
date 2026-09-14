'use client';

import { usePathname, useRouter, useSearchParams, useParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSprints } from '@/hooks/useSprints';

// A simple debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function WorkItemFiltersInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const projectId = params.projectId as string;
  
  const { data: sprints = [] } = useSprints(projectId);

  const currentSearch = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(currentSearch);
  const debouncedSearch = useDebounce(searchTerm, 300);

  const updateParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (debouncedSearch !== (searchParams.get('search') || '')) {
      updateParam('search', debouncedSearch || null);
    }
  }, [debouncedSearch, searchParams, updateParam]);

  const state = searchParams.get('state') || '';
  const type = searchParams.get('type') || '';
  const priority = searchParams.get('priority') || '';
  const assignedTo = searchParams.get('assignedTo') || '';
  const sprintId = searchParams.get('sprintId') || '';
  
  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by ID, title or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm w-64 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={type}
          onChange={(e) => updateParam('type', e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm bg-transparent"
        >
          <option value="">All Types</option>
          <option value="TASK">Task</option>
          <option value="BUG">Bug</option>
          <option value="STORY">Story</option>
        </select>

        <select
          value={state}
          onChange={(e) => updateParam('state', e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm bg-transparent"
        >
          <option value="">All States</option>
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="DONE">Done</option>
        </select>

        <select
          value={priority}
          onChange={(e) => updateParam('priority', e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm bg-transparent"
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>

        <select
          value={assignedTo}
          onChange={(e) => updateParam('assignedTo', e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm bg-transparent"
        >
          <option value="">All Assignees</option>
          <option value="UNASSIGNED">Unassigned</option>
          {/* We might want to list users here eventually, but for now we rely on explicit IDs or leave as basic string match if implemented */}
        </select>

        <select
          value={sprintId}
          onChange={(e) => updateParam('sprintId', e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm bg-transparent"
        >
          <option value="">All Sprints</option>
          <option value="null">Backlog (No Sprint)</option>
          {sprints.map((s: { id: string; name: string }) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function WorkItemFilters() {
  return (
    <Suspense fallback={<div className="h-[46px] w-full animate-pulse bg-gray-100 dark:bg-gray-800 rounded-md mb-6" />}>
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

  const sprintId = searchParams.get('sprintId');
  if (sprintId) filters.sprintId = sprintId;

  const search = searchParams.get('search');
  if (search) filters.search = search;

  return filters;
}
