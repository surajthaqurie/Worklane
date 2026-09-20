export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export class CreateWorkItemDto {
  type: 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
  title: string;
  description?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  severity?: SeverityLevel | null;
  points?: number | null;
  remainingWork?: number | null;
  completedWork?: number | null;
  startDate?: string | null;
  targetDate?: string | null;
  customFields?: Record<string, unknown>;
  assignedTo?: string | null;
  parentId?: string | null;
  areaId?: string | null;
  iterationId?: string | null;
  teamId?: string | null;
  tags?: string[];
  closedAt?: string | null;
}

export class UpdateWorkItemDto {
  type?: 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
  title?: string;
  description?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  severity?: SeverityLevel | null;
  points?: number | null;
  remainingWork?: number | null;
  completedWork?: number | null;
  startDate?: string | null;
  targetDate?: string | null;
  customFields?: Record<string, unknown>;
  assignedTo?: string | null;
  parentId?: string | null;
  iterationId?: string | null;
  areaId?: string | null;
  tags?: string[];
  closedAt?: string | null;
  backlogOrder?: number;
  expectedVersion?: number;
}
