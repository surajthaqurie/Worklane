import { z } from 'zod';

export const createIterationSchema = z.object({
  name: z.string().min(1).max(255),
  goal: z.string().optional().nullable(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  parentId: z.string().uuid().optional().nullable(),
});

export class CreateIterationDto {
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  parentId?: string | null;
}

export const updateIterationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  goal: z.string().optional().nullable(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  parentId: z.string().uuid().optional().nullable(),
  state: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED']).optional(),
});

export class UpdateIterationDto {
  name?: string;
  goal?: string | null;
  startDate?: string;
  endDate?: string;
  parentId?: string | null;
  state?: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
}

export class AddWorkItemsDto {
  workItemIds: string[];
}

export class CompleteIterationDto {
  /** What to do with work items that aren't in a done state */
  incompleteAction: 'MOVE_TO_NEXT' | 'MOVE_TO_BACKLOG';
  /** Required when incompleteAction === 'MOVE_TO_NEXT' */
  targetIterationId?: string | null;
}

export class BulkMoveWorkItemsDto {
  workItemIds: string[];
  /** null = move to backlog (no iteration) */
  targetIterationId: string | null;
}
