import { apiClient } from '@/shared/utils/apiClient';
import { NotificationsResponse, Notification } from '@/shared/types/notifications';

export const notificationsApi = {
  getNotifications: (limit = 20) => apiClient.get<NotificationsResponse>(`/notifications?limit=${limit}`),
  markAsRead: (id: string) => apiClient.post<Notification>(`/notifications/${id}/read`),
  markAllAsRead: () => apiClient.post<{ success: boolean }>('/notifications/read-all'),
};
