'use client';

import { Suspense, use, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useWorkItems } from '@/features/work-items/hooks/useWorkItems';
import { useWorkItemStates } from '@/features/work-items/hooks/useWorkItemStates';
import { WorkItem } from '@/shared/types/work-items';
import { useProjectContext } from '@/app/(app)/projects/[projectId]/project-layout-client';
import { WorkItemDrawer } from '@/features/work-items/components/WorkItemDrawer';
import { CreateWorkItemModal } from '@/features/work-items/components/CreateWorkItemModal';
import { Search, Filter, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/shared/hooks/useToast';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { WorkItemPriorityBadge } from '@/features/work-items/components/WorkItemBadge';

const PAGE_SIZE = 50;

export default function WorkItemsPage({ params }: { params: Promise<{ projectId: string }> }) {
  return (
    <Suspense fallback={null}>
      <WorkItemsPageContent params={params} />
    </Suspense>
  );
}

function WorkItemsPageContent({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = use(params);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedTeamId } = useProjectContext();
  const { isItemPending } = useToast();
  const { data: states = [] } = useWorkItemStates(resolvedParams.projectId);
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);

  const isCreateModalOpen = searchParams.get('new') === '1';

  const openModal = () => router.push(`${pathname}?new=1`);
  const closeModal = () => router.replace(pathname);

  const { data: workItems = [], isLoading } = useWorkItems(
    resolvedParams.projectId,
    selectedTeamId,
    {
      search: debouncedSearch.trim() || undefined,
      state: statusFilter || undefined,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    },
  );

  const hasNextPage = workItems.length === PAGE_SIZE;

  return (
    <div className="w-full flex flex-col h-full relative p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-4 border-b border-[var(--border-subtle)] shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">Work Items</h1>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
            All work items across the project.
          </p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0 gap-3">
          <button
            onClick={openModal}
            className="px-4 py-2 bg-[var(--brand-primary)] hover:opacity-90 text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors"
          >
            + New Work Item
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus:outline-none focus:border-[var(--border-focus)] transition-colors placeholder:text-[var(--text-muted)] text-[var(--text-primary)]"
            />
          </div>

          <div className="relative w-full sm:w-48">
            <Filter className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)]" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus:outline-none focus:border-[var(--border-focus)] transition-colors appearance-none text-[var(--text-primary)]"
            >
              <option value="">All Statuses</option>
              {states.map((s) => (
                <option key={s.id} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <span>
            Page {page + 1}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="p-1 rounded hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNextPage || isLoading}
              className="p-1 rounded hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-full inline-block align-middle">
          <div className="border border-[var(--border-subtle)] rounded-[var(--radius-card)] overflow-hidden bg-[var(--bg-surface)]">
            <table className="min-w-full divide-y divide-[var(--border-subtle)]">
              <thead className="bg-[var(--bg-surface-hover)]">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-[12px] font-medium text-[var(--text-secondary)]">ID</th>
                  <th scope="col" className="px-4 py-3 text-left text-[12px] font-medium text-[var(--text-secondary)] w-1/2">Title</th>
                  <th scope="col" className="px-4 py-3 text-left text-[12px] font-medium text-[var(--text-secondary)]">State</th>
                  <th scope="col" className="px-4 py-3 text-left text-[12px] font-medium text-[var(--text-secondary)]">Priority</th>
                  <th scope="col" className="px-4 py-3 text-left text-[12px] font-medium text-[var(--text-secondary)]">Assignee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-surface)]">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
                      Loading work items...
                    </td>
                  </tr>
                ) : workItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
                      No work items found.
                    </td>
                  </tr>
                ) : (
                  workItems.map((item) => {
                    const isPending = isItemPending(item.id);
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors group ${
                          isPending ? 'opacity-70 bg-[var(--bg-surface-selected)]/50' : ''
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-[13px] font-medium text-[var(--text-secondary)]">
                          <div className="flex items-center gap-1.5">
                            {isPending ? (
                              <Loader2 className="w-3.5 h-3.5 text-[var(--brand-primary)] animate-spin" />
                            ) : null}
                            <span>{item.key}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[var(--text-primary)] font-medium">
                          {item.title}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--bg-surface-hover)] text-[var(--text-primary)]">
                            {item.state.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <WorkItemPriorityBadge priority={item.priority} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div
                              className="w-6 h-6 rounded-[var(--radius-avatar)] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[10px] text-[var(--text-primary)]"
                              title={item.assignedToName || item.assignedTo || 'Unassigned'}
                            >
                              {item.assignedToName
                                ? item.assignedToName.substring(0, 2).toUpperCase()
                                : 'UI'}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedItem && <WorkItemDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />}

      <CreateWorkItemModal
        projectId={resolvedParams.projectId}
        teamId={selectedTeamId}
        isOpen={isCreateModalOpen}
        onClose={closeModal}
      />
    </div>
  );
}
