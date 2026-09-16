import { z } from 'zod';
import { WorkItemState } from '../work-item-transitions.service.js';

export const StateTransitionSchema = z.object({
  state: z.enum(['New', 'Active', 'Resolved', 'Closed', 'Removed']),
});

export class StateTransitionDto {
  state: WorkItemState;
}
