import { z } from 'zod';

export const CreateWorkItemSchema = z.object({
  type: z.enum(['TASK', 'BUG', 'STORY']),
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
});
export class CreateWorkItemDto {
  type: 'TASK' | 'BUG' | 'STORY';
  title: string;
  description?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo?: string | null;
  parentId?: string | null;
}

export const UpdateWorkItemSchema = z.object({
  type: z.enum(['TASK', 'BUG', 'STORY']).optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  state: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  sprintId: z.string().uuid().optional().nullable(),
});
export class UpdateWorkItemDto {
  type?: 'TASK' | 'BUG' | 'STORY';
  title?: string;
  description?: string | null;
  state?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo?: string | null;
  parentId?: string | null;
  sprintId?: string | null;
}
