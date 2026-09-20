import { apiClient } from '@/shared/utils/apiClient';
import { NotificationsResponse, Notification, NotificationPreferences } from '@/shared/types/notifications';

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

export const notificationsApi = {
  getNotifications: (limit = 20) => apiClient.get<NotificationsResponse>(`/notifications?limit=${limit}`),
  markAsRead: (id: string) => apiClient.post<Notification>(`/notifications/${id}/read`),
  markAllAsRead: () => apiClient.post<{ success: boolean }>('/notifications/read-all'),

  // Phase 14 — Followers API
  getFollowers: (projectId: string, workItemId: string) =>
    apiClient.get<FollowerDto[]>(`/projects/${projectId}/work-items/${workItemId}/followers`),
  getFollowStatus: (projectId: string, workItemId: string) =>
    apiClient.get<FollowStatusDto>(`/projects/${projectId}/work-items/${workItemId}/followers/status`),
  followWorkItem: (projectId: string, workItemId: string) =>
    apiClient.post<{ success: boolean; isFollowing: boolean }>(
      `/projects/${projectId}/work-items/${workItemId}/follow`,
    ),
  unfollowWorkItem: (projectId: string, workItemId: string) =>
    apiClient.delete<{ success: boolean; isFollowing: boolean }>(
      `/projects/${projectId}/work-items/${workItemId}/follow`,
    ),

  // Phase 14 — Preferences API
  getPreferences: () => apiClient.get<NotificationPreferences>('/notifications/preferences'),
  updatePreferences: (prefs: Partial<NotificationPreferences>) =>
    apiClient.patch<NotificationPreferences>('/notifications/preferences', prefs),
};
