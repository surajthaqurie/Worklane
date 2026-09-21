import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkItemsRepository, WipConstraint } from './work-items.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';

import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class WorkItemTransitionsService {
  constructor(
    private readonly repo: WorkItemsRepository,
    private readonly authz: AuthorizationService,
    private readonly notifications: NotificationsService,
  ) {}

  async transitionState(
    userId: string,
    id: string,
    targetState: string,
    expectedVersion?: number,
    wipConstraint?: WipConstraint,
  ) {
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

    const currentState = item.state as string;

    if (currentState === targetState) {
      throw new BadRequestException(`Work item is already in state ${targetState}`);
    }

    // The project's configurable workflow is the single source of truth: any
    // state defined for the project is a valid target (Azure Boards style),
    // and completion is derived from that state's `isDone` flag.
    const projectStates = await this.repo.getProjectStates(item.project_id);
    let target = projectStates.find((s) => s.key === targetState);

    if (!target && targetState.startsWith('col-')) {
      const cleanKey = targetState.slice(4);
      target = projectStates.find(
        (s) => s.key === cleanKey || s.key.toLowerCase() === cleanKey.toLowerCase()
      );
      if (target) {
        targetState = target.key;
      }
    }

    if (!target) {
      throw new BadRequestException(
        `Unknown state "${targetState}" for this project's workflow`,
      );
    }

    const updated = await this.repo.updateState(
      id,
      userId,
      currentState,
      targetState,
      target.isDone,
      expectedVersion,
      wipConstraint,
    );

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
