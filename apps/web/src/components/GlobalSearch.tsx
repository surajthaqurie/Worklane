'use client';

import { useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Search, Loader2, AlertCircle, CornerDownLeft } from 'lucide-react';
import { useGlobalSearch, GlobalSearchResult } from '@/hooks/useGlobalSearch';
import { useWorkItem } from '@/hooks/useWorkItems';
import { WorkItemDrawer } from '@/components/WorkItemDrawer';
import { TYPE_LABELS, TYPE_COLORS, TYPE_BG } from '@/hooks/useBacklog';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const RESULT_LIMIT = 10;

export function GlobalSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 300);
  const activeQuery = debouncedQuery.trim();

  const { data, isLoading, isError, error, refetch } = useGlobalSearch(
    { q: activeQuery, limit: RESULT_LIMIT },
    { enabled: isOpen && activeQuery.length > 0 },
  );

  // ⌘K / Ctrl+K focuses the global search.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelect = (result: GlobalSearchResult) => {
    setSelectedId(result.id);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="flex w-full md:ml-0 max-w-md items-center">
      <div className="relative w-full text-[var(--text-muted)] focus-within:text-[var(--text-primary)] transition-colors">
        <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none pl-3">
          <Search className="w-4 h-4" aria-hidden="true" />
        </div>
        <input
          ref={inputRef}
          id="search-field"
          className="block w-full py-1.5 pl-9 pr-12 text-[13px] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
          placeholder="Search work items across projects..."
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <kbd className="absolute inset-y-0 right-3 hidden md:flex items-center gap-0.5 text-[11px] text-[var(--text-muted)] pointer-events-none">
          <CornerDownLeft className="w-3 h-3" aria-hidden="true" />
          K
        </kbd>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div
              className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] shadow-lg overflow-hidden"
              role="listbox"
              aria-label="Search results"
            >
              {activeQuery.length === 0 ? (
                <div className="px-4 py-8 text-[13px] text-[var(--text-muted)] text-center">
                  Type to search work items across your projects.
                </div>
              ) : isLoading ? (
                <div className="px-4 py-8 text-[13px] text-[var(--text-muted)] flex flex-col items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Searching...
                </div>
              ) : isError ? (
                <div className="px-4 py-6 text-[13px] flex flex-col items-center gap-3">
                  <span className="inline-flex items-center gap-2 text-[var(--priority-high)]">
                    <AlertCircle className="w-4 h-4" aria-hidden="true" />
                    {error instanceof Error
                      ? error.message
                      : 'Something went wrong while searching.'}
                  </span>
                  <button
                    onClick={() => refetch()}
                    className="text-[12px] font-medium px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors"
                  >
                    Try again
                  </button>
                </div>
              ) : !data || data.items.length === 0 ? (
                <div className="px-4 py-8 text-[13px] text-[var(--text-muted)] text-center">
                  No work items found for “{activeQuery}”.
                </div>
              ) : (
                <>
                  <div className="max-h-[420px] overflow-y-auto py-1">
                    {data.items.map((result) => (
                      <SearchResultRow
                        key={result.id}
                        result={result}
                        onSelect={() => handleSelect(result)}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)]">
                    <span>
                      {data.total > RESULT_LIMIT
                        ? `Showing top ${RESULT_LIMIT} of ${data.total} results`
                        : `${data.total} result${data.total === 1 ? '' : 's'}`}
                    </span>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {selectedId && (
        <SelectedItemDrawer
          workItemId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function SearchResultRow({
  result,
  onSelect,
}: {
  result: GlobalSearchResult;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      className="w-full text-left px-4 py-2.5 hover:bg-[var(--bg-surface-hover)] transition-colors group flex flex-col gap-1"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-button)] text-[10px] font-bold uppercase tracking-wide flex-shrink-0"
          style={{
            backgroundColor: TYPE_BG[result.type],
            color: TYPE_COLORS[result.type],
          }}
        >
          {TYPE_LABELS[result.type]}
        </span>
        <span className="text-[12px] font-medium text-[var(--text-secondary)] flex-shrink-0">
          {result.key}
        </span>
        <span className="text-[13px] font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--brand-primary)] transition-colors">
          {result.title}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[12px] text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)]"
            aria-hidden="true"
          />
          {result.project.name}
        </span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]">
          {result.state.replace('_', ' ')}
        </span>
        <span>{result.assignedToName ?? 'Unassigned'}</span>
        <span className="ml-auto flex-shrink-0">
          Updated {formatDistanceToNow(new Date(result.updatedAt), { addSuffix: true })}
        </span>
      </div>
    </button>
  );
}

function SelectedItemDrawer({
  workItemId,
  onClose,
}: {
  workItemId: string | null;
  onClose: () => void;
}) {
  const { data: item } = useWorkItem(workItemId);
  if (!item) return null;
  return <WorkItemDrawer item={item} onClose={onClose} />;
}