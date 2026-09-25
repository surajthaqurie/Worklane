import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import type { BurndownDto, VelocityDto } from '../../analytics/dto/analytics.dto.js';

export const WIDGET_TYPES = [
  'SPRINT_SUMMARY',
  'BURNDOWN',
  'VELOCITY',
  'MY_WORK_ITEMS',
  'BLOCKED_ITEMS',
  'ACTIVITY',
  'TEAM_PROGRESS',
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

export const widgetLayoutSchema = z.object({
  id: z.string().min(1),
  type: z.enum(WIDGET_TYPES),
  position: z.number().int().min(0),
  colSpan: z.number().int().min(1).max(3),
  rowSpan: z.number().int().min(1).max(3).optional().default(1),
  visible: z.boolean().default(true),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type WidgetLayoutDto = z.infer<typeof widgetLayoutSchema>;

export const saveDashboardLayoutSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  widgets: z.array(widgetLayoutSchema),
});

export type SaveDashboardLayoutDto = z.infer<typeof saveDashboardLayoutSchema>;

export const getDashboardLayoutQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
});

export type GetDashboardLayoutQueryDto = z.infer<typeof getDashboardLayoutQuerySchema>;

export const resetDashboardLayoutSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
});

export type ResetDashboardLayoutDto = z.infer<typeof resetDashboardLayoutSchema>;

export const getDashboardDataQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
});

export type GetDashboardDataQueryDto = z.infer<typeof getDashboardDataQuerySchema>;

export interface SprintSummaryData {
  iteration: {
    id: string;
    name: string;
    goal: string | null;
    startDate: string;
    endDate: string;
    state: string;
  } | null;
  totalPoints: number;
  completedPoints: number;
  remainingPoints: number;
  totalItems: number;
  completedItems: number;
  inProgressItems: number;
  todoItems: number;
  daysRemaining: number;
}

export interface DashboardWorkItem {
  id: string;
  seqNo: number;
  projectKey: string;
  title: string;
  type: string;
  state: string;
  priority: string;
  points: number | null;
  updatedAt: string;
}

export interface DashboardBlockedItem {
  id: string;
  seqNo: number;
  projectKey: string;
  title: string;
  type: string;
  state: string;
  priority: string;
  blockedBy: {
    id: string;
    seqNo: number;
    projectKey: string;
    title: string;
    state: string;
  } | null;
  reason: string;
}

export interface DashboardActivityItem {
  id: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  workItemSeq: number;
  workItemTitle: string;
  userName: string;
  userAvatar?: string | null;
}

export interface DashboardTeamMemberProgress {
  userId: string;
  name: string;
  avatarUrl: string | null;
  assignedCount: number;
  inProgressCount: number;
  doneCount: number;
  totalPoints: number;
}

export interface DashboardDataDto {
  scope: {
    projectId: string | null;
    teamId: string | null;
  };
  sprintSummary: SprintSummaryData | null;
  burndown: BurndownDto | null;
  velocity: VelocityDto | null;
  myWorkItems: DashboardWorkItem[];
  blockedItems: DashboardBlockedItem[];
  activity: DashboardActivityItem[];
  teamProgress: DashboardTeamMemberProgress[];
  generatedAt: string;
}

export function parseDashboardInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException(
      result.error.issues.map((issue) => issue.message).join('; '),
    );
  }
  return result.data;
}
