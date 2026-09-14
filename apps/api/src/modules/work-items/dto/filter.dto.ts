import { z } from 'zod';

export const WorkItemFilterSchema = z.object({
  search: z.string().optional(),
  state: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  type: z.enum(['TASK', 'BUG', 'STORY']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().optional(),
  sprintId: z.string().optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});

export type WorkItemFilterDto = z.infer<typeof WorkItemFilterSchema>;
