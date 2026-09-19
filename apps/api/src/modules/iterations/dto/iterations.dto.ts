export class CreateIterationDto {
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  parentId?: string | null;
}

export class UpdateIterationDto {
  name?: string;
  goal?: string | null;
  startDate?: string;
  endDate?: string;
  parentId?: string | null;
  state?: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
}

export class AddWorkItemsDto {
  workItemIds: string[];
}

export class CompleteIterationDto {
  /** What to do with work items that aren't in a done state */
  incompleteAction: 'MOVE_TO_NEXT' | 'MOVE_TO_BACKLOG';
  /** Required when incompleteAction === 'MOVE_TO_NEXT' */
  targetIterationId?: string | null;
}

export class BulkMoveWorkItemsDto {
  workItemIds: string[];
  /** null = move to backlog (no iteration) */
  targetIterationId: string | null;
}
