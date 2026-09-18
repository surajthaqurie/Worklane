import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/notificationsApi';
import { NotificationsResponse } from '@/shared/types/notifications';
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
