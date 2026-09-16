import { z } from 'zod';

export const CreateWorkItemStateSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().max(20).optional(),
  isDone: z.boolean().optional(),
});

export class CreateWorkItemStateDto {
  name: string;
  color?: string;
  isDone?: boolean;
}

export const UpdateWorkItemStateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().max(20).optional(),
  isDone: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export class UpdateWorkItemStateDto {
  name?: string;
  color?: string;
  isDone?: boolean;
  sortOrder?: number;
}

export const ReorderWorkItemStatesSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export class ReorderWorkItemStatesDto {
  orderedIds: string[];
}