import { WorkItemFilterDto } from "./dto/filter.dto.js";
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { WorkItemsRepository } from './work-items.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { TeamsService } from '../teams/teams.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission, hasPermission } from '../authorization/permissions.js';
import { CreateWorkItemDto, UpdateWorkItemDto } from './dto/work-items.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { WorkItemTypeRegistryService } from './work-item-types.registry.js';
import { db } from '../../db/kysely.js';

@Injectable()
export class WorkItemsService {
  constructor(
    private readonly repo: WorkItemsRepository,
    private readonly projectsService: ProjectsService,
    private readonly teamsService: TeamsService,
    private readonly authz: AuthorizationService,
    private readonly notifications: NotificationsService,
    private readonly typeRegistry: WorkItemTypeRegistryService,
  ) {}

  getTypeDefinitions() {
    return this.typeRegistry.getAllTypes();
  }

  private validateFieldInputs(data: CreateWorkItemDto | UpdateWorkItemDto) {
    if (data.type && !this.typeRegistry.isValidType(data.type)) {
      throw new BadRequestException(`Invalid work item type: ${data.type}`);
    }
    if (data.severity && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(data.severity)) {
      throw new BadRequestException(`Invalid severity level: ${data.severity}`);
    }
    if (data.remainingWork !== undefined && data.remainingWork !== null && (isNaN(Number(data.remainingWork)) || Number(data.remainingWork) < 0)) {
      throw new BadRequestException('remainingWork must be a non-negative number');
    }
    if (data.completedWork !== undefined && data.completedWork !== null && (isNaN(Number(data.completedWork)) || Number(data.completedWork) < 0)) {
      throw new BadRequestException('completedWork must be a non-negative number');
    }
    if (data.startDate && data.targetDate) {
      const start = new Date(data.startDate);
      const target = new Date(data.targetDate);
      if (!isNaN(start.getTime()) && !isNaN(target.getTime()) && target < start) {
        throw new BadRequestException('targetDate cannot be earlier than startDate');
      }
    }
  }

  async create(userId: string, projectId: string, data: CreateWorkItemDto) {
    this.validateFieldInputs(data);
    // Never trust projectId from the client alone — confirm membership via authz
    const { project } = await this.authz.requireProjectPermissionWithProject(
      projectId,
      userId,
      Permission.WORK_ITEM_CREATE,
    );

    if (data.parentId) {
      // validateParent already checks cross-project (parent must be in same project)
      await this.validateParent(data.parentId, data.type, projectId);
    }

    const createData = { ...data } as CreateWorkItemDto;

    if (createData.teamId) {
      await this.teamsService.assertTeamMember(projectId, createData.teamId, userId);
      const settings = await this.teamsService.getSettings(userId, projectId, createData.teamId);
      if (!createData.areaId && settings.defaultAreaId) {
        createData.areaId = settings.defaultAreaId;
      }
      if (!createData.iterationId && settings.defaultIterationId) {
        createData.iterationId = settings.defaultIterationId;
      }
    }

    const item = await this.repo.createWorkItem(projectId, userId, createData);
    const mapped = this.mapWorkItem(item, project.key);

    if (createData.assignedTo) {
      await this.notifications.notifyAssigned({
        actorId: userId,
        workItemId: item.id,
        title: item.title,
        key: mapped.key,
        assignedTo: createData.assignedTo,
      });
    }

    return mapped;
  }

  async findAll(userId: string, projectId: string, filters: WorkItemFilterDto) {
    const { project } = await this.authz.requireProjectPermissionWithProject(
      projectId,
      userId,
      Permission.WORK_ITEM_VIEW,
    );

    if (filters.teamId && filters.teamId !== 'default' && filters.teamId !== 'undefined') {
      await this.teamsService.assertTeamMember(projectId, filters.teamId, userId);
    }
    // DB query is always project-scoped — projectId comes from the URL param, not the body
    const items = await this.repo.getWorkItems(projectId, filters);
    return items.map((item) => this.mapWorkItem(item, project.key));
  }

  async findOne(userId: string, id: string) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');

    // Derive the project from the item, never from client input
    const { project } = await this.authz.requireProjectPermissionWithProject(
      item.project_id,
      userId,
      Permission.WORK_ITEM_VIEW,
    );
    return this.mapWorkItem(item, project.key);
  }

  async update(userId: string, id: string, data: UpdateWorkItemDto) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');

    this.validateFieldInputs(data);
    // Determine required permission based on what fields are being changed
    const permission =
      data.assignedTo !== undefined && Object.keys(data).length === 1
        ? // Only assigning — requires WORK_ITEM_ASSIGN
          Permission.WORK_ITEM_ASSIGN
        : // General edit — requires WORK_ITEM_EDIT
          Permission.WORK_ITEM_EDIT;

    const { project } = await this.authz.requireProjectPermissionWithProject(
      item.project_id,
      userId,
      permission,
    );

    if ((data as any).state !== undefined) {
      throw new BadRequestException('State transitions must be done via the dedicated transition endpoint');
    }

    if (data.parentId !== undefined) {
      if (data.parentId) {
        if (data.parentId === id) throw new BadRequestException('Cannot set self as parent');
        const typeToValidate = data.type || item.type;
        // validateParent enforces same-project constraint
        await this.validateParent(data.parentId, typeToValidate, item.project_id);
        await this.checkCircularDependency(id, data.parentId);
      }
    } else if (data.type !== undefined) {
       if (item.parent_id) {
           await this.validateParent(item.parent_id, data.type, item.project_id);
       }
    }

    if (data.iterationId !== undefined && data.iterationId) {
      const iterationProjectId = await this.repo.getIterationProjectId(data.iterationId);
      if (!iterationProjectId) {
        throw new BadRequestException('Iteration not found');
      }
      // Cross-project iteration assignment check
      if (iterationProjectId !== item.project_id) {
        throw new BadRequestException('Iteration does not belong to the same project');
      }
    }

    if (data.areaId !== undefined && data.areaId) {
      // Cross-project area assignment check
      const areaProjectId = await this.repo.getAreaProjectId(data.areaId);
      if (!areaProjectId || areaProjectId !== item.project_id) {
        throw new BadRequestException('Area does not belong to the same project');
      }
    }

    const updated = await this.repo.updateWorkItem(id, userId, data);
    const mapped = this.mapWorkItem(updated, project.key);

    if (data.assignedTo !== undefined && data.assignedTo !== item.assigned_to && data.assignedTo) {
      await this.notifications.notifyAssigned({
        actorId: userId,
        workItemId: id,
        title: updated.title,
        key: mapped.key,
        assignedTo: data.assignedTo,
      });
    }

    if (data.iterationId !== undefined && data.iterationId !== item.iteration_id) {
      if (data.iterationId) {
        await this.notifications.notifyAddedToSprint({
          actorId: userId,
          workItemId: id,
          title: updated.title,
          key: mapped.key,
          assignedTo: updated.assigned_to,
          createdBy: updated.created_by,
          iterationId: data.iterationId,
        });
      } else {
        await this.notifications.notifyRemovedFromSprint({
          actorId: userId,
          workItemId: id,
          title: updated.title,
          key: mapped.key,
          assignedTo: updated.assigned_to,
          createdBy: updated.created_by,
          previousIterationId: item.iteration_id,
        });
      }
    }

    if (data.parentId !== undefined && data.parentId !== item.parent_id) {
      let newParentAssignedTo: string | null = null;
      if (data.parentId) {
        const parentItem = await this.repo.getWorkItemById(data.parentId);
        newParentAssignedTo = parentItem?.assigned_to ?? null;
      }
      await this.notifications.notifyParentChanged({
        actorId: userId,
        workItemId: id,
        title: updated.title,
        key: mapped.key,
        assignedTo: updated.assigned_to,
        createdBy: updated.created_by,
        oldParentId: item.parent_id,
        newParentId: data.parentId ?? null,
        newParentAssignedTo,
      });
    }

    return mapped;
  }

  async validateParentAndCircularity(itemId: string, parentId: string, projectId: string, itemType?: string) {
    if (parentId === itemId) throw new BadRequestException('Cannot set self as parent');
    const item = await this.repo.getWorkItemById(itemId);
    const typeToValidate = itemType || item?.type || 'STORY';
    await this.validateParent(parentId, typeToValidate, projectId);
    await this.checkCircularDependency(itemId, parentId);
  }

  private async validateParent(parentId: string, childType: string, projectId: string) {
    const parent = await this.repo.getWorkItemById(parentId);
    if (!parent) throw new BadRequestException('Parent not found');
    // Cross-project parent assignment is explicitly forbidden
    if (parent.project_id !== projectId) {
      throw new ForbiddenException('Cross-project parent assignment is not allowed');
    }

    if (!this.typeRegistry.isAllowedParent(parent.type, childType)) {
      throw new BadRequestException(`Work item of type ${parent.type} cannot be parent of ${childType}`);
    }
  }

  private async checkCircularDependency(itemId: string, newParentId: string) {
    let currentParentId: string | null = newParentId;
    let depth = 0;
    while (currentParentId) {
      depth++;
      if (depth > 10) {
        throw new BadRequestException('Hierarchy depth limit exceeded (maximum 10 levels)');
      }
      if (currentParentId === itemId) {
        throw new BadRequestException('Circular dependency detected');
      }
      const parent = await this.repo.getWorkItemById(currentParentId);
      if (!parent) break;
      currentParentId = parent.parent_id;
    }
  }

  async getWorkItemRollup(userId: string, projectId: string, itemId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_VIEW);
    const item = await this.repo.getWorkItemById(itemId);
    if (!item || item.project_id !== projectId) {
      throw new NotFoundException('Work item not found in project');
    }
    const rollups = await this.repo.getBatchRollups(projectId, [itemId]);
    return rollups[itemId] || {
      itemId,
      descendantCount: 0,
      completedCount: 0,
      totalPoints: 0,
      completedPoints: 0,
      remainingWork: 0,
      completedWork: 0,
      completionPercentage: 0,
    };
  }

  async getBatchWorkItemRollups(userId: string, projectId: string, itemIds: string[]) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_VIEW);
    return await this.repo.getBatchRollups(projectId, itemIds);
  }

  async getWorkItemHierarchy(userId: string, projectId: string, itemId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_VIEW);
    const hierarchy = await this.repo.getHierarchyTree(projectId, itemId);
    if (!hierarchy) {
      throw new NotFoundException('Work item not found in project');
    }
    return hierarchy;
  }

  async remove(userId: string, id: string) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');

    // Delete requires elevated permission (ADMIN or OWNER)
    await this.authz.requireProjectPermission(item.project_id, userId, Permission.WORK_ITEM_DELETE);

    await this.repo.deleteWorkItem(id, userId);
    return { success: true };
  }

  async getComments(
    userId: string,
    id: string,
    opts: { limit?: number; cursor?: string },
  ) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');
    await this.authz.requireProjectPermission(item.project_id, userId, Permission.WORK_ITEM_VIEW);
    return await this.repo.getComments(id, {
      limit: opts.limit ?? 20,
      cursor: opts.cursor,
    });
  }

  async addComment(userId: string, id: string, content: string) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');

    const { project } = await this.authz.requireProjectPermissionWithProject(
      item.project_id,
      userId,
      Permission.WORK_ITEM_VIEW,
    );

    const comment = await this.repo.createComment(id, userId, content);
    const key = `${project.key}-${item.seq_no}`;

    await this.parseAndNotifyMentions(
      userId,
      item.project_id,
      id,
      item.title,
      key,
      comment.id,
      content,
    );

    return comment;
  }

  private async parseAndNotifyMentions(
    actorId: string,
    projectId: string,
    workItemId: string,
    title: string,
    key: string,
    commentId: string,
    content: string,
  ) {
    const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
    const foundUuids = content.match(uuidRegex) || [];

    const members = await this.projectsService.getMembers(actorId, projectId);
    const mentionedUserIds = new Set<string>(foundUuids);

    const lowerContent = content.toLowerCase();
    for (const member of members) {
      if (member.userId === actorId) continue;
      const firstName = member.name ? member.name.split(' ')[0].toLowerCase() : '';
      const nameMatch = member.name && lowerContent.includes(`@${member.name.toLowerCase()}`);
      const firstNameMatch = firstName && lowerContent.includes(`@${firstName}`);
      const noSpaceNameMatch = member.name && lowerContent.includes(`@${member.name.toLowerCase().replace(/\s+/g, '')}`);
      const emailMatch = member.email && lowerContent.includes(`@${member.email.toLowerCase()}`);
      const idMatch = lowerContent.includes(`@${member.userId.toLowerCase()}`);
      if (nameMatch || firstNameMatch || noSpaceNameMatch || emailMatch || idMatch) {
        mentionedUserIds.add(member.userId);
      }
    }

    if (this.notifications?.parseAndValidateMentions) {
      const validated = await this.notifications.parseAndValidateMentions(projectId, content);
      for (const id of validated) {
        if (id !== actorId) mentionedUserIds.add(id);
      }
    }

    const userIds = Array.from(mentionedUserIds);
    const snippet = content.length > 100 ? content.slice(0, 100) + '...' : content;

    if (userIds.length > 0 && this.notifications?.notifyMentioned) {
      await this.notifications.notifyMentioned({
        actorId,
        workItemId,
        title,
        key,
        commentId,
        snippet,
        mentionedUserIds: userIds,
      });
    }

    if (this.notifications?.notifyCommentAdded) {
      await this.notifications.notifyCommentAdded({
        actorId,
        workItemId,
        title,
        key,
        commentId,
        snippet,
      });
    }
  }

  async updateComment(
    userId: string,
    id: string,
    commentId: string,
    content: string,
    expectedVersion: number,
  ) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');

    const { project } = await this.authz.requireProjectPermissionWithProject(
      item.project_id,
      userId,
      Permission.WORK_ITEM_VIEW,
    );

    const existingComment = await db
      .selectFrom('work_item_comments')
      .where('id', '=', commentId)
      .where('deleted_at', 'is', null)
      .select(['work_item_id', 'user_id'])
      .executeTakeFirst();

    if (!existingComment || existingComment.work_item_id !== id) {
      throw new NotFoundException('Comment not found');
    }

    if (existingComment.user_id !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const updated = await this.repo.updateComment(
      commentId,
      userId,
      content,
      expectedVersion,
    );

    const key = `${project.key}-${item.seq_no}`;

    await this.parseAndNotifyMentions(
      userId,
      item.project_id,
      id,
      item.title,
      key,
      commentId,
      content,
    );

    return updated;
  }

  async deleteComment(
    userId: string,
    id: string,
    commentId: string,
    expectedVersion: number,
  ) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');
    const membership = await this.authz.requireProjectPermission(
      item.project_id,
      userId,
      Permission.WORK_ITEM_VIEW,
    );

    const existingComment = await db
      .selectFrom('work_item_comments')
      .where('id', '=', commentId)
      .where('deleted_at', 'is', null)
      .select(['work_item_id', 'user_id'])
      .executeTakeFirst();

    if (!existingComment || existingComment.work_item_id !== id) {
      throw new NotFoundException('Comment not found');
    }

    const canDelete =
      existingComment.user_id === userId ||
      hasPermission(membership.role, Permission.WORK_ITEM_DELETE);

    if (!canDelete) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    return await this.repo.deleteComment(commentId, userId, expectedVersion);
  }

  async getActivity(userId: string, id: string) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');
    await this.authz.requireProjectPermission(item.project_id, userId, Permission.WORK_ITEM_VIEW);
    return await this.repo.getActivity(id);
  }

  private mapWorkItem(item: any, projectKey: string) {
    return {
      id: item.id,
      key: `${projectKey}-${item.seq_no}`,
      projectId: item.project_id,
      type: item.type,
      title: item.title,
      description: item.description,
      state: item.state,
      priority: item.priority,
      severity: item.severity ?? 'MEDIUM',
      points: item.points ?? null,
      remainingWork: item.remaining_work != null ? Number(item.remaining_work) : null,
      completedWork: item.completed_work != null ? Number(item.completed_work) : null,
      startDate: item.start_date ?? null,
      targetDate: item.target_date ?? null,
      customFields: item.custom_fields ?? {},
      assignedTo: item.assigned_to,
      createdBy: item.created_by,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      completedAt: item.completed_at,
      parentId: item.parent_id,
      iterationId: item.iteration_id,
      areaId: item.area_id,
      tags: item.tags || [],
      backlogOrder: item.backlog_order,
      hasChildren: item.has_children ?? false,
      version: item.version ?? 1,
    };
  }
}

