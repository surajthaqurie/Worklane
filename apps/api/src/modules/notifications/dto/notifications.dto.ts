import { z } from 'zod';

export enum NotificationType {
  ASSIGNED = 'ASSIGNED',
  MENTIONED = 'MENTIONED',
  STATE_CHANGED = 'STATE_CHANGED',
  ADDED_TO_SPRINT = 'ADDED_TO_SPRINT',
  REMOVED_FROM_SPRINT = 'REMOVED_FROM_SPRINT',
  PARENT_CHANGED = 'PARENT_CHANGED',
  WORK_ITEM_UPDATED = 'WORK_ITEM_UPDATED',
  COMMENT_ADDED = 'COMMENT_ADDED',
  FOLLOWED = 'FOLLOWED',
}

export const getNotificationsQuerySchema = z.object({
  unreadOnly: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;

export const updateNotificationPreferencesSchema = z.object({
  channelInApp: z.boolean().optional(),
  channelEmail: z.boolean().optional(),
  notifyMentions: z.boolean().optional(),
  notifyAssigned: z.boolean().optional(),
  notifyFollowed: z.boolean().optional(),
});

export type UpdateNotificationPreferencesDto = z.infer<typeof updateNotificationPreferencesSchema>;

export interface NotificationMetadata {
  title?: string;
  key?: string;
  actorName?: string;
  commentId?: string;
  snippet?: string;
  oldState?: string;
  newState?: string;
  iterationId?: string;
  sprintName?: string;
  previousIterationId?: string | null;
  oldParentId?: string | null;
  newParentId?: string | null;
  [key: string]: unknown;
}

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType | string;
  workItemId: string | null;
  actorId: string;
  metadata: NotificationMetadata;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferencesDto {
  userId: string;
  channelInApp: boolean;
  channelEmail: boolean;
  notifyMentions: boolean;
  notifyAssigned: boolean;
  notifyFollowed: boolean;
  createdAt: string;
  updatedAt: string;
}
