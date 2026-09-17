export interface NotificationMetadata {
  key?: string;
  title?: string;
  oldState?: string;
  newState?: string;
  sprintName?: string;
  snippet?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'ASSIGNED' | 'MENTIONED' | 'STATE_CHANGED' | 'ADDED_TO_SPRINT' | 'REMOVED_FROM_SPRINT' | 'PARENT_CHANGED' | string;
  workItemId: string | null;
  actorId: string;
  metadata: NotificationMetadata;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}
