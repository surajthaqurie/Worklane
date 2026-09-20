import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, FollowStatusDto, FollowerDto } from '../api/notificationsApi';
import { NotificationsResponse, NotificationPreferences } from '@/shared/types/notifications';
import { useToast } from '@/shared/hooks/useToast';
import { formatApiError } from '@/shared/utils/error';

export function useNotifications(limit = 20) {
  return useQuery<NotificationsResponse>({
    queryKey: ['notifications', { limit }],
    queryFn: () => notificationsApi.getNotifications(limit),
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: (updated) => {
      queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        const res = old as NotificationsResponse;
        return {
          ...res,
          unreadCount: Math.max(0, res.unreadCount - 1),
          notifications: res.notifications.map((n) =>
            n.id === updated.id ? { ...n, readAt: updated.readAt || new Date().toISOString() } : n
          ),
        };
      });
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
      queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        const res = old as NotificationsResponse;
        return {
          ...res,
          unreadCount: 0,
          notifications: res.notifications.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })),
        };
      });
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
