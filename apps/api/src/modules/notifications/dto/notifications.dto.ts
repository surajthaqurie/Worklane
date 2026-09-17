import { z } from 'zod';

export enum NotificationType {
  ASSIGNED = 'ASSIGNED',
  MENTIONED = 'MENTIONED',
  STATE_CHANGED = 'STATE_CHANGED',
  ADDED_TO_SPRINT = 'ADDED_TO_SPRINT',
  REMOVED_FROM_SPRINT = 'REMOVED_FROM_SPRINT',
  PARENT_CHANGED = 'PARENT_CHANGED',
}

export const getNotificationsQuerySchema = z.object({
  unreadOnly: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType | string;
  workItemId: string | null;
  actorId: string;
  metadata: Record<string, any>;
  readAt: string | null;
  createdAt: string;
}
