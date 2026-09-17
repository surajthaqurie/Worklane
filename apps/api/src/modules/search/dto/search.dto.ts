export const WORK_ITEM_TYPES = ['EPIC', 'FEATURE', 'STORY', 'TASK', 'BUG'] as const;

export class GlobalSearchDto {
  q?: string;
  projectId?: string;
  type?: (typeof WORK_ITEM_TYPES)[number];
  state?: string;
  assignedTo?: string;
  tags?: string;
  limit?: string;
  offset?: string;
}