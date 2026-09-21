import { z } from 'zod';

export type BacklogLevel = 'EPIC' | 'FEATURE' | 'STORY';
export const BACKLOG_LEVELS = ['EPIC', 'FEATURE', 'STORY'] as const;

/**
 * Swimlane grouping modes. `none` renders a single flat board.
 *
 * Architecture note: the frontend groups cards through a per-mode registry
 * (`features/boards/swimlanes.ts`), so future custom groupings only register a
 * new mode + grouper here and select it from the same field.
 */
export type SwimlaneType = 'none' | 'assignee' | 'priority' | 'epic';
export const SWIMLANE_TYPES = ['none', 'assignee', 'priority', 'epic'] as const;

export interface BoardColumn {
  id: string;
  name: string;
  mappedStates: string[];
  wipLimit?: number | null;
}

export interface CardFields {
  showType?: boolean;
  showPriority?: boolean;
  showAssignee?: boolean;
  showPoints?: boolean;
  showParent?: boolean;
  showTags?: boolean;
}

export interface FilterConfig {
  backlogLevel?: BacklogLevel;
  types?: string[];
  assignedTo?: string | null;
  tags?: string | null;
  search?: string | null;
  iterationId?: string | null;
  areaId?: string | null;
}

export const BoardColumnSchema = z.object({
  id: z.string().min(1, { message: 'Every board column must have an ID' }),
  name: z.string().min(1, { message: 'Every board column must have a name' }),
  mappedStates: z
    .array(z.string().min(1))
    .min(1, { message: 'A board column must map to at least one workflow state' })
    .refine((states) => new Set(states).size === states.length, {
      message: 'A board column cannot map a workflow state more than once',
    }),
  wipLimit: z.number().int().min(0).nullable().optional(),
});

export const CardFieldsSchema = z.object({
  showType: z.boolean().optional(),
  showPriority: z.boolean().optional(),
  showAssignee: z.boolean().optional(),
  showPoints: z.boolean().optional(),
  showParent: z.boolean().optional(),
  showTags: z.boolean().optional(),
});

export const FilterConfigSchema = z.object({
  backlogLevel: z.enum(BACKLOG_LEVELS).optional(),
  types: z.array(z.string().min(1)).optional(),
  assignedTo: z.string().nullable().optional(),
  tags: z.string().nullable().optional(),
  search: z.string().nullable().optional(),
  iterationId: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
});

export const CreateBoardSchema = z.object({
  name: z.string().trim().min(1, { message: 'Board name is required' }),
  description: z.string().optional(),
  teamId: z.string().nullable().optional(),
  swimlane: z.enum(SWIMLANE_TYPES).optional(),
  columns: z.array(BoardColumnSchema).optional(),
  cardFields: CardFieldsSchema.optional(),
  filterConfig: FilterConfigSchema.optional(),
});

export const UpdateBoardSchema = z.object({
  name: z.string().trim().min(1, { message: 'Board name cannot be empty' }).optional(),
  description: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  swimlane: z.enum(SWIMLANE_TYPES).optional(),
  columns: z.array(BoardColumnSchema).optional(),
  cardFields: CardFieldsSchema.optional(),
  filterConfig: FilterConfigSchema.optional(),
});

/** Body for moving a work item across a board (WIP-aware state transition). */
export const MoveWorkItemSchema = z.object({
  state: z.string().trim().min(1, { message: 'Target state is required' }),
  expectedVersion: z.number().int().positive().optional(),
  bypassWip: z.boolean().optional(),
});

export class CreateBoardDto {
  name!: string;
  description?: string;
  teamId?: string | null;
  swimlane?: SwimlaneType;
  columns?: BoardColumn[];
  cardFields?: CardFields;
  filterConfig?: FilterConfig;
}

export class UpdateBoardDto {
  name?: string;
  description?: string | null;
  teamId?: string | null;
  isDefault?: boolean;
  swimlane?: SwimlaneType;
  columns?: BoardColumn[];
  cardFields?: CardFields;
  filterConfig?: FilterConfig;
}

export class MoveWorkItemDto {
  state!: string;
  expectedVersion?: number;
  bypassWip?: boolean;
}

