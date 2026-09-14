import { z } from 'zod';

export const createSprintSchema = z.object({
  name: z.string().min(1),
  goal: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export class CreateSprintDto {
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
}

export class UpdateSprintDto {
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  state?: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
}

export class AddWorkItemsDto {
  workItemIds: string[];
}
