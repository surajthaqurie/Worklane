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
  type: 'ASSIGNED' | 'MENTIONED' | 'STATE_CHANGED' | 'ADDED_TO_SPRINT' | 'REMOVED_FROM_SPRINT' | 'PARENT_CHANGED' | 'WORK_ITEM_UPDATED' | 'COMMENT_ADDED' | 'FOLLOWED' | string;
  workItemId: string | null;
  actorId: string;
  actor?: { name?: string };
  /** Display name of the user who triggered the event (enriched at query time). */
  actorName?: string;
  /** Project owning the notification resource — enables navigation to the work item. */
  projectId?: string | null;
  /** Work item key, e.g. "PROJ-42" (enriched at query time). */
  workItemKey?: string | null;
  /** Work item title (enriched at query time). */
  workItemTitle?: string | null;
  metadata: NotificationMetadata;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  /** Cursor for the next page of notifications, or null when there are no more. */
  nextCursor: string | null;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface NotificationPreferences {
  userId: string;
  channelInApp: boolean;
  channelEmail: boolean;
  notifyMentions: boolean;
  notifyAssigned: boolean;
  notifyFollowed: boolean;
  createdAt: string;
  updatedAt: string;
}
