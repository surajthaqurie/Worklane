export class CreateWorkItemStateDto {
  name: string;
  color?: string;
  isDone?: boolean;
}

export class UpdateWorkItemStateDto {
  name?: string;
  color?: string;
  isDone?: boolean;
  sortOrder?: number;
}

export class ReorderWorkItemStatesDto {
  orderedIds: string[];
}