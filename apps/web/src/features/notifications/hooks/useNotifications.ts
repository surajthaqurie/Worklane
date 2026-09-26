import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { notificationsApi, FollowStatusDto, FollowerDto, GetNotificationsParams } from '../api/notificationsApi';
import { NotificationsResponse, NotificationPreferences, UnreadCountResponse } from '@/shared/types/notifications';
import { useToast } from '@/shared/hooks/useToast';
import { formatApiError } from '@/shared/utils/error';

export const notificationKeys = {
  all: () => ['notifications'] as const,
  list: (params: GetNotificationsParams = {}) => ['notifications', 'list', params] as const,
  infinite: (unreadOnly: boolean, limit: number) =>
    ['notifications', 'infinite', { unreadOnly, limit }] as const,
  unreadCount: () => ['notifications', 'unread-count'] as const,
  followStatus: (projectId?: string, workItemId?: string) =>
    ['work-item-follow-status', projectId, workItemId] as const,
  followers: (projectId?: string, workItemId?: string) =>
    ['work-item-followers', projectId, workItemId] as const,
  preferences: () => ['notification-preferences'] as const,
};

export function useNotifications(options: GetNotificationsParams = {}) {
  const { limit = 20, unreadOnly = false, cursor = null } = options;
  return useQuery<NotificationsResponse>({
    queryKey: notificationKeys.list(options),
    queryFn: () => notificationsApi.getNotifications({ limit, unreadOnly, cursor }),
  });
}

/** Cursor-paginated feed for the notification center (accumulates pages). */
export function useNotificationsInfinite(unreadOnly = false, limit = 25) {
  return useInfiniteQuery<NotificationsResponse>({
    queryKey: notificationKeys.infinite(unreadOnly, limit),
    queryFn: ({ pageParam }) =>
      notificationsApi.getNotifications({
        limit,
        unreadOnly,
        cursor: (pageParam as string | null) ?? null,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useUnreadCount() {
  return useQuery<UnreadCountResponse>({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationsApi.getUnreadCount(),
  });
}

/**
 * Update every cached notifications shape (plain NotificationsResponse and
 * React Query InfiniteData pages) after a read/mark-all mutation.
 */
function patchNotificationsCache(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (res: NotificationsResponse) => NotificationsResponse,
) {
  queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: unknown) => {
    if (!old || typeof old !== 'object') return old;
    if (Array.isArray((old as NotificationsResponse).notifications)) {
      return updater(old as NotificationsResponse);
    }
    const infinite = old as { pages?: NotificationsResponse[]; pageParams?: unknown[] };
    if (Array.isArray(infinite.pages) && Array.isArray(infinite.pageParams)) {
      return {
        ...infinite,
        pages: infinite.pages.map((page) =>
          page && Array.isArray(page.notifications) ? updater(page) : page,
        ),
      };
    }
    return old;
  });
  queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: (updated) => {
      patchNotificationsCache(queryClient, (res) => ({
        ...res,
        unreadCount: Math.max(
          0,
          res.unreadCount - (res.notifications.some((n) => n.id === updated.id && !n.readAt) ? 1 : 0),
        ),
        notifications: res.notifications.map((n) =>
          n.id === updated.id ? { ...n, readAt: updated.readAt || new Date().toISOString() } : n
        ),
      }));
    },
    onError: (err) => {
      toast.showError('Failed to mark notification read', formatApiError(err));
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      patchNotificationsCache(queryClient, (res) => ({
        ...res,
        unreadCount: 0,
        notifications: res.notifications.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })),
      }));
    },
    onError: (err) => {
      toast.showError('Failed to mark all notifications read', formatApiError(err));
    },
  });
}

// ─── Followers Hooks (Phase 14) ──────────────────────────────────────────────

export function useFollowStatus(projectId?: string, workItemId?: string) {
  return useQuery<FollowStatusDto>({
    queryKey: ['work-item-follow-status', projectId, workItemId],
    queryFn: () => notificationsApi.getFollowStatus(projectId!, workItemId!),
    enabled: Boolean(projectId && workItemId),
  });
}

export function useWorkItemFollowers(projectId?: string, workItemId?: string) {
  return useQuery<FollowerDto[]>({
    queryKey: ['work-item-followers', projectId, workItemId],
    queryFn: () => notificationsApi.getFollowers(projectId!, workItemId!),
    enabled: Boolean(projectId && workItemId),
  });
}

export function useFollowWorkItem(projectId?: string, workItemId?: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: () => notificationsApi.followWorkItem(projectId!, workItemId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-item-follow-status', projectId, workItemId] });
      queryClient.invalidateQueries({ queryKey: ['work-item-followers', projectId, workItemId] });
      toast.showSuccess('Now following work item');
    },
    onError: (err) => {
      toast.showError('Failed to follow work item', formatApiError(err));
    },
  });
}

export function useUnfollowWorkItem(projectId?: string, workItemId?: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: () => notificationsApi.unfollowWorkItem(projectId!, workItemId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-item-follow-status', projectId, workItemId] });
      queryClient.invalidateQueries({ queryKey: ['work-item-followers', projectId, workItemId] });
      toast.showSuccess('Unfollowed work item');
    },
    onError: (err) => {
      toast.showError('Failed to unfollow work item', formatApiError(err));
    },
  });
}

// ─── Notification Preferences Hooks (Phase 14) ──────────────────────────────

export function useNotificationPreferences() {
  return useQuery<NotificationPreferences>({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationsApi.getPreferences(),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (prefs: Partial<NotificationPreferences>) => notificationsApi.updatePreferences(prefs),
    onSuccess: (updated) => {
      queryClient.setQueryData(['notification-preferences'], updated);
      toast.showSuccess('Notification preferences updated');
    },
    onError: (err) => {
      toast.showError('Failed to update preferences', formatApiError(err));
    },
  });
}
