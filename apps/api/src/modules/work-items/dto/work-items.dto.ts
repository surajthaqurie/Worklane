import { z } from 'zod';

export const CreateWorkItemSchema = z.object({
  type: z.enum(['EPIC', 'FEATURE', 'STORY', 'TASK', 'BUG']),
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  points: z.number().int().min(0).optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
});
export class CreateWorkItemDto {
  type: 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
  title: string;
  description?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  points?: number | null;
  assignedTo?: string | null;
  parentId?: string | null;
}

export const UpdateWorkItemSchema = z.object({
  type: z.enum(['EPIC', 'FEATURE', 'STORY', 'TASK', 'BUG']).optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  state: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  points: z.number().int().min(0).optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  sprintId: z.string().uuid().optional().nullable(),
});
export class UpdateWorkItemDto {
  type?: 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
  title?: string;
  description?: string | null;
  state?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  points?: number | null;
  assignedTo?: string | null;
  parentId?: string | null;
  sprintId?: string | null;
}
