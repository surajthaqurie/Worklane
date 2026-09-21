'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bell, CheckCheck, WifiOff, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Spinner, EmptyState, ErrorState } from '@/shared/components/ui';
import { NotificationItem } from '@/features/notifications/components/NotificationItem';
import {
  useNotificationsInfinite,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from '@/features/notifications/hooks/useNotifications';
import { useNotificationSocket } from '@/features/notifications/hooks/useNotificationSocket';
import { Notification } from '@/shared/types/notifications';

type Filter = 'all' | 'unread';

function isFilter(value: string | null): value is Filter {
  return value === 'all' || value === 'unread';
}

export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-12">
          <Spinner size="lg" />
        </div>
      }
    >
      <NotificationsPageContent />
    </Suspense>
  );
}

function NotificationsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawFilter = searchParams.get('filter');
  const filter: Filter = isFilter(rawFilter) ? rawFilter : 'all';

  const socketState = useNotificationSocket();
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotificationsInfinite(filter === 'unread', 25);

  const markAsReadMut = useMarkNotificationAsRead();
  const markAllAsReadMut = useMarkAllNotificationsAsRead();

  const notifications = data?.pages.flatMap((page) => page.notifications) ?? [];
  const unreadCount = data?.pages[0]?.unreadCount ?? 0;

  const setFilter = (next: Filter) => {
    router.replace(next === 'all' ? '/notifications' : '/notifications?filter=unread', {
      scroll: false,
    });
  };

  const handleNavigate = useCallback(
    (n: Notification) => {
      if (!n.projectId || !n.workItemId) return;
      router.push(`/projects/${n.projectId}/work-items?item=${n.workItemId}`);
    },
    [router],
  );

  return (
    <div className="w-full flex flex-col space-y-6">
      <PageHeader
        title="Notifications"
        description="Track mentions, assignments, and updates across your work items."
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] p-1 w-fit">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-button)] transition-colors ${
                filter === f
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {f === 'all' ? 'All' : 'Unread'}
              {f === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 text-[11px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {socketState.error && (
            <span className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
              <WifiOff className="w-3.5 h-3.5" />
              Real-time updates unavailable
            </span>
          )}
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsReadMut.mutate()}
              disabled={markAllAsReadMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-blue-600 dark:text-blue-400 border border-[var(--border-subtle)] rounded-[var(--radius-button)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] shadow-sm min-h-[300px]">
        {isError ? (
          <ErrorState error={error} title="Failed to load notifications" onRetry={() => refetch()} className="border-0 rounded-none" />
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 gap-3 min-h-[300px]">
            <Spinner size="lg" />
            <span className="text-xs text-[var(--text-secondary)]">Loading notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              description={
                filter === 'unread'
                  ? 'You are all caught up — no unread notifications right now.'
                  : 'Mentions, assignments, and work item updates will appear here.'
              }
              icon={<Bell className="w-6 h-6" />}
            />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {notifications.map((n) => (
                <li key={n.id}>
                  <NotificationItem
                    notification={n}
                    onMarkAsRead={(id) => markAsReadMut.mutate(id)}
                    onNavigate={handleNavigate}
                  />
                </li>
              ))}
            </ul>

            {hasNextPage && (
              <div className="flex justify-center p-4 border-t border-[var(--border-subtle)]">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-[var(--brand-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50 transition-colors"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading more...
                    </>
                  ) : (
                    'Load more'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}