import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkItemsRepository } from './work-items.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';

import { NotificationsService } from '../notifications/notifications.service.js';

export type WorkItemState = 'New' | 'Active' | 'Resolved' | 'Closed' | 'Removed';

export const STATE_TRANSITIONS: Record<string, Record<WorkItemState, WorkItemState[]>> = {
  EPIC: {
    New: ['Active', 'Closed', 'Removed'],
    Active: ['Resolved', 'Closed', 'New'],
    Resolved: ['Active', 'Closed'],
    Closed: ['Active'],
    Removed: ['New'],
  },
  FEATURE: {
    New: ['Active', 'Closed', 'Removed'],
    Active: ['Resolved', 'Closed', 'New'],
    Resolved: ['Active', 'Closed'],
    Closed: ['Active'],
    Removed: ['New'],
  },
  STORY: {
    New: ['Active', 'Closed', 'Removed'],
    Active: ['Resolved', 'Closed', 'New'],
    Resolved: ['Active', 'Closed'],
    Closed: ['Active'],
    Removed: ['New'],
  },
  TASK: {
    New: ['Active', 'Closed', 'Removed'],
    Active: ['Resolved', 'Closed', 'New'],
    Resolved: ['Active', 'Closed'],
    Closed: ['Active'],
    Removed: ['New'],
  },
  BUG: {
    New: ['Active', 'Closed', 'Removed'],
    Active: ['Resolved', 'Closed', 'New'],
    Resolved: ['Active', 'Closed'],
    Closed: ['Active'],
    Removed: ['New'],
  },
};

@Injectable()
export class WorkItemTransitionsService {
  constructor(
    private readonly repo: WorkItemsRepository,
    private readonly authz: AuthorizationService,
    private readonly notifications: NotificationsService,
  ) {}

  async transitionState(userId: string, id: string, targetState: string) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) {
      throw new NotFoundException('Work item not found');
    }

    // Derive project from the item row — never from client input
    await this.authz.requireProjectPermission(
      item.project_id,
      userId,
      Permission.WORK_ITEM_CHANGE_STATE,
    );

    const currentState = item.state as WorkItemState;
    const type = item.type;

    if (!STATE_TRANSITIONS[type]) {
      throw new BadRequestException(`No state transitions defined for work item type ${type}`);
    }

    const validTransitions = STATE_TRANSITIONS[type][currentState] || [];

    if (currentState === targetState) {
      throw new BadRequestException(`Work item is already in state ${targetState}`);
    }

    if (!validTransitions.includes(targetState as WorkItemState)) {
      throw new BadRequestException(
        `Invalid state transition from ${currentState} to ${targetState} for type ${type}`,
      );
    }

    const updated = await this.repo.updateState(id, userId, currentState, targetState);

    await this.notifications.notifyStateChanged({
      actorId: userId,
      workItemId: id,
      title: item.title,
      assignedTo: item.assigned_to,
      createdBy: item.created_by,
      oldState: currentState,
      newState: targetState,
    });

    return updated;
  }
}
