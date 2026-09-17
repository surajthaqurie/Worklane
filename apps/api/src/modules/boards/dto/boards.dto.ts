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
  backlogLevel?: 'EPIC' | 'FEATURE' | 'STORY';
  types?: string[];
  assignedTo?: string | null;
  tags?: string | null;
  search?: string | null;
  iterationId?: string | null;
  areaId?: string | null;
}

export class CreateBoardDto {
  name!: string;
  description?: string;
  teamId?: string | null;
  columns?: BoardColumn[];
  cardFields?: CardFields;
  filterConfig?: FilterConfig;
}

export class UpdateBoardDto {
  name?: string;
  description?: string | null;
  teamId?: string | null;
  isDefault?: boolean;
  columns?: BoardColumn[];
  cardFields?: CardFields;
  filterConfig?: FilterConfig;
}
