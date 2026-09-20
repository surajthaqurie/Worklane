import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { BacklogRepository } from './backlog.repository.js';
import { TeamsService } from '../teams/teams.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';

import { WorkItemsRepository } from './work-items.repository.js';
import { WorkItemsService } from './work-items.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { db } from '../../db/kysely.js';

class ReorderDto {
  id: string;
  parentId?: string | null;
  previousItemId?: string | null;
  nextItemId?: string | null;
  newRank?: number;
  teamId?: string;
  iterationId?: string | null;
  state?: string;
  expectedVersion?: number;
  idempotencyKey?: string;
}

class BulkAssignIterationDto {
  itemIds: string[];
  iterationId: string | null;
  teamId?: string;
  expectedVersions?: Record<string, number>;
  idempotencyKey?: string;
}

@Controller()
@UseGuards(AuthGuard)
export class BacklogController {
  constructor(
    private readonly backlogRepo: BacklogRepository,
    private readonly workItemsRepo: WorkItemsRepository,
    private readonly workItemsService: WorkItemsService,
    private readonly teamsService: TeamsService,
    private readonly authz: AuthorizationService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('projects/:projectId/backlog')
  async getBacklog(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Query('parentId') parentId?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('state') state?: string,
    @Query('priority') priority?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('iterationId') iterationId?: string,
    @Query('areaId') areaId?: string,
    @Query('teamId') teamId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { project } = await this.authz.requireProjectPermissionWithProject(
      projectId,
      req.user.id,
      Permission.BACKLOG_VIEW,
    );

    let teamAreaIds: string[] | undefined;
    let teamIterationIds: string[] | undefined;
    if (teamId && teamId !== 'default' && teamId !== 'undefined') {
      await this.teamsService.assertTeamMember(projectId, teamId, req.user.id);
      const scope = await this.teamsService.getTeamScope(projectId, teamId);
      teamAreaIds = scope.areaIds;
      teamIterationIds = scope.iterationIds;
    }

    let resolvedParentId: string | null;
    if (parentId === undefined || parentId === 'null' || parentId === '') {
      resolvedParentId = null;
    } else {
      resolvedParentId = parentId;
    }

    return this.backlogRepo.getBacklogTree(
      projectId,
      {
        parentId: resolvedParentId,
        search,
        type,
        state,
        priority,
        assignedTo,
        iterationId,
        areaId,
        teamAreaIds,
        teamIterationIds,
        limit: limit ? parseInt(limit, 10) : 100,
        offset: offset ? parseInt(offset, 10) : 0,
      },
      project.key,
    );
  }

  @Post('projects/:projectId/backlog/reorder')
  async reorder(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Body() dto: ReorderDto,
  ) {
    await this.authz.requireProjectPermission(projectId, req.user.id, Permission.BACKLOG_MANAGE);

    if (!dto.id) throw new BadRequestException('id is required');

    // Verify item belongs to project
    await this.authz.requireWorkItemInProject(dto.id, projectId);

    if (dto.parentId) {
      await this.authz.requireWorkItemInProject(dto.parentId, projectId);
      await this.workItemsService.validateParentAndCircularity(dto.id, dto.parentId, projectId);
    }

    if (dto.teamId && dto.teamId !== 'default' && dto.teamId !== 'undefined') {
      await this.teamsService.assertTeamMember(projectId, dto.teamId, req.user.id);
      const itemsToCheck = [dto.id];
      if (dto.previousItemId) itemsToCheck.push(dto.previousItemId);
      if (dto.nextItemId) itemsToCheck.push(dto.nextItemId);
      await this.teamsService.assertItemsInTeamScope(
        req.user.id,
        projectId,
        dto.teamId,
        itemsToCheck,
      );
    }

    const oldItem = await this.workItemsRepo.getWorkItemById(dto.id);

    await this.backlogRepo.reorderItem(projectId, req.user.id, {
      id: dto.id,
      parentId: dto.parentId ?? (dto.parentId === null ? null : undefined),
      previousItemId: dto.previousItemId ?? null,
      nextItemId: dto.nextItemId ?? null,
      newRank: dto.newRank,
      expectedVersion: dto.expectedVersion,
      teamId: dto.teamId ?? null,
      iterationId: dto.iterationId ?? (dto.iterationId === null ? null : undefined),
      state: dto.state ?? undefined,
    });

    if (oldItem && dto.parentId !== undefined && (dto.parentId ?? null) !== oldItem.parent_id) {
      let newParentAssignedTo: string | null = null;
      if (dto.parentId) {
        const parentItem = await this.workItemsRepo.getWorkItemById(dto.parentId);
        newParentAssignedTo = parentItem?.assigned_to ?? null;
      }
      await this.notifications.notifyParentChanged({
        actorId: req.user.id,
        workItemId: dto.id,
        title: oldItem.title,
        assignedTo: oldItem.assigned_to,
        createdBy: oldItem.created_by,
        oldParentId: oldItem.parent_id,
        newParentId: dto.parentId ?? null,
        newParentAssignedTo,
      });
    }

    return { success: true };
  }

  @Post('projects/:projectId/backlog/bulk-assign-iteration')
  async bulkAssignIteration(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Body() dto: BulkAssignIterationDto,
  ) {
    await this.authz.requireProjectPermission(projectId, req.user.id, Permission.BACKLOG_MANAGE);

    if (!Array.isArray(dto.itemIds) || dto.itemIds.length === 0) {
      throw new BadRequestException('itemIds must be a non-empty array');
    }

    // Verify all items belong to this project
    for (const itemId of dto.itemIds) {
      await this.authz.requireWorkItemInProject(itemId, projectId);
    }

    if (dto.iterationId) {
      // Validate iteration belongs to same project
      const iterationProjectId = await this.workItemsRepo.getIterationProjectId(dto.iterationId);
      if (!iterationProjectId || iterationProjectId !== projectId) {
        throw new BadRequestException('Iteration does not belong to the same project');
      }
    }

    if (dto.teamId && dto.teamId !== 'default') {
      await this.teamsService.assertItemsInTeamScope(
        req.user.id,
        projectId,
        dto.teamId,
        dto.itemIds,
      );
    }

    await this.backlogRepo.bulkAssignIteration(
      projectId,
      req.user.id,
      dto.itemIds,
      dto.iterationId ?? null,
      dto.expectedVersions,
    );

    let sprintName: string | undefined;
    if (dto.iterationId) {
      const it = await db
        .selectFrom('iterations')
        .where('id', '=', dto.iterationId)
        .select('name')
        .executeTakeFirst();
      sprintName = it?.name;
    }

    for (const itemId of dto.itemIds) {
      const item = await this.workItemsRepo.getWorkItemById(itemId);
      if (item) {
        if (dto.iterationId) {
          await this.notifications.notifyAddedToSprint({
            actorId: req.user.id,
            workItemId: itemId,
            title: item.title,
            assignedTo: item.assigned_to,
            createdBy: item.created_by,
            iterationId: dto.iterationId,
            sprintName,
          });
        } else {
          await this.notifications.notifyRemovedFromSprint({
            actorId: req.user.id,
            workItemId: itemId,
            title: item.title,
            assignedTo: item.assigned_to,
            createdBy: item.created_by,
            previousIterationId: item.iteration_id,
          });
        }
      }
    }

    return { success: true };
  }
}

