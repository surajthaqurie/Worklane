import { apiClient } from '@/shared/utils/apiClient';
import { NotificationsResponse, Notification, NotificationPreferences, UnreadCountResponse } from '@/shared/types/notifications';

export interface FollowerDto {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  followedAt: string;
}

export interface FollowStatusDto {
  isFollowing: boolean;
  followerCount: number;
}

export interface GetNotificationsParams {
  limit?: number;
  cursor?: string | null;
  unreadOnly?: boolean;
}

export const notificationsApi = {
  getNotifications: (params: GetNotificationsParams = {}) => {
    const { limit = 20, cursor, unreadOnly } = params;
    const searchParams = new URLSearchParams();
    searchParams.set('limit', String(limit));
    if (cursor) searchParams.set('cursor', cursor);
    if (unreadOnly) searchParams.set('unreadOnly', 'true');
    return apiClient.get<NotificationsResponse>(`/notifications?${searchParams.toString()}`);
  },
  getUnreadCount: () => apiClient.get<UnreadCountResponse>('/notifications/unread-count'),
  markAsRead: (id: string) => apiClient.post<Notification>(`/notifications/${id}/read`),
  markAllAsRead: () => apiClient.post<{ success: boolean }>('/notifications/read-all'),

  // Phase 14 — Followers API
  getFollowers: (projectId: string, workItemId: string) =>
    apiClient.get<FollowerDto[]>(`/projects/${projectId}/work-items/${workItemId}/followers`),
  getFollowStatus: (projectId: string, workItemId: string) =>
    apiClient.get<FollowStatusDto>(`/projects/${projectId}/work-items/${workItemId}/follow-status`),
  followWorkItem: (projectId: string, workItemId: string) =>
    apiClient.post<{ success: boolean; isFollowing: boolean }>(
      `/projects/${projectId}/work-items/${workItemId}/follow`,
    ),
  unfollowWorkItem: (projectId: string, workItemId: string) =>
    apiClient.delete<{ success: boolean; isFollowing: boolean }>(
      `/projects/${projectId}/work-items/${workItemId}/follow`,
    ),

  // Phase 14 — Preferences API
  getPreferences: () => apiClient.get<NotificationPreferences>('/users/me/notification-preferences'),
  updatePreferences: (prefs: Partial<NotificationPreferences>) =>
    apiClient.patch<NotificationPreferences>('/users/me/notification-preferences', prefs),
};
