import { z } from 'zod';

export const createIterationSchema = z.object({
  name: z.string().min(1),
  goal: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export class CreateIterationDto {
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
}

export class UpdateIterationDto {
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  state?: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
}

export class AddWorkItemsDto {
  workItemIds: string[];
}
