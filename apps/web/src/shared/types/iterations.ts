export type IterationStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export interface Iteration {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: IterationStatus;
  state?: IterationStatus;
  createdAt: string;
  updatedAt: string;
  workItemCount?: number;
  completedCount?: number;
  incompleteCount?: number;
}

export interface CreateIterationDto {
  name: string;
  goal?: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateIterationDto {
  name?: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: IterationStatus;
}
