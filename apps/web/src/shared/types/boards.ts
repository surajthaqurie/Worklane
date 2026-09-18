import { WorkItem, WorkItemState } from './work-items';

export type BacklogLevel = 'EPIC' | 'FEATURE' | 'STORY';

export interface CardFields {
  showType: boolean;
  showPriority: boolean;
  showAssignee: boolean;
  showPoints: boolean;
  showParent: boolean;
  showTags: boolean;
}

export interface BoardColumn {
  id: string;
  name: string;
  mappedStates: string[];
  wipLimit: number | null;
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

export interface BoardConfig {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  columns: BoardColumn[];
  cardFields: CardFields;
  filterConfig: FilterConfig;
  teamId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SprintBoardGroup {
  state: WorkItemState;
  items: WorkItem[];
}

export interface SprintBoard {
  groups: SprintBoardGroup[];
  states: WorkItemState[];
}