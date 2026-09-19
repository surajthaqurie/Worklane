export class WorkItemFilterDto {
  search?: string;
  state?: string;
  type?: 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
  types?: string | string[];
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo?: string;
  iterationId?: string;
  areaId?: string;
  teamId?: string;
  tags?: string;
  limit?: string;
  offset?: string;
  parentId?: string;
  fields?: string;
}
