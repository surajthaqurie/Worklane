import { z } from 'zod';

export const StateTransitionSchema = z.object({
  state: z.string().trim().min(1, { message: 'Target state is required' }),
});

export class StateTransitionDto {
  state!: string;
}
