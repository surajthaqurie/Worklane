import { z } from 'zod';

export const WorkItemFilterSchema = z.object({
  search: z.string().optional(),
  state: z.string().optional(),
  type: z.enum(['EPIC', 'FEATURE', 'STORY', 'TASK', 'BUG']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().optional(),
  iterationId: z.string().optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});

export class WorkItemFilterDto {
  search?: string;
  state?: string;
  type?: 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo?: string;
  iterationId?: string;
  limit?: string;
  offset?: string;
}
