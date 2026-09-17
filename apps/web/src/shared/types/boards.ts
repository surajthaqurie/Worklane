import { WorkItem, WorkItemState } from './work-items';

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

export interface BoardConfig {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  columns: BoardColumn[];
  cardFields: CardFields;
  teamId?: string | null;
}

export interface SprintBoardGroup {
  state: string;
  items: WorkItem[];
}

export interface SprintBoard {
  groups: SprintBoardGroup[];
  states: WorkItemState[];
}
