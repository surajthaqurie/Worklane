import { WorkItemFilterDto } from "./dto/filter.dto.js";
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkItemsRepository } from './work-items.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { CreateWorkItemDto, UpdateWorkItemDto } from './dto/work-items.dto.js';

@Injectable()
export class WorkItemsService {
  constructor(
    private readonly repo: WorkItemsRepository,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(userId: string, projectId: string, data: CreateWorkItemDto) {
    const project = await this.projectsService.assertProjectMember(
      projectId,
      userId,
    );
    if (data.parentId) {
      await this.validateParent(data.parentId, data.type, projectId);
    }
    const item = await this.repo.createWorkItem(projectId, userId, data);
    return this.mapWorkItem(item, project.key);
  }

  async findAll(userId: string, projectId: string, filters: WorkItemFilterDto) {
    const project = await this.projectsService.assertProjectMember(
      projectId,
      userId,
    );
    const items = await this.repo.getWorkItems(projectId, filters);
    return items.map((item) => this.mapWorkItem(item, project.key));
  }

  async findOne(userId: string, id: string) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');
    const project = await this.projectsService.assertProjectMember(
      item.project_id,
      userId,
    );
    return this.mapWorkItem(item, project.key);
  }

  async update(userId: string, id: string, data: UpdateWorkItemDto) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');
    const project = await this.projectsService.assertProjectMember(
      item.project_id,
      userId,
    );
    if ((data as any).state !== undefined) {
      throw new BadRequestException('State transitions must be done via the dedicated transition endpoint');
    }

    if (data.parentId !== undefined) {
      if (data.parentId) {
        if (data.parentId === id) throw new BadRequestException('Cannot set self as parent');
        const typeToValidate = data.type || item.type;
        await this.validateParent(data.parentId, typeToValidate, item.project_id);
        await this.checkCircularDependency(id, data.parentId);
      }
    } else if (data.type !== undefined) {
       if (item.parent_id) {
           await this.validateParent(item.parent_id, data.type, item.project_id);
       }
    }
    const updated = await this.repo.updateWorkItem(id, userId, data);
    return this.mapWorkItem(updated, project.key);
  }

  private async validateParent(parentId: string, childType: string, projectId: string) {
    const parent = await this.repo.getWorkItemById(parentId);
    if (!parent) throw new BadRequestException('Parent not found');
    if (parent.project_id !== projectId) throw new BadRequestException('Cross-project parent is not allowed');
    
    const allowedParents: Record<string, string[]> = {
      'EPIC': [],
      'FEATURE': ['EPIC'],
      'STORY': ['FEATURE'],
      'TASK': ['STORY', 'BUG'],
      'BUG': ['STORY'],
    };
    
    const allowed = allowedParents[childType] || [];
    if (!allowed.includes(parent.type)) {
      throw new BadRequestException(`Work item of type ${parent.type} cannot be parent of ${childType}`);
    }
  }

  private async checkCircularDependency(itemId: string, newParentId: string) {
    let currentParentId: string | null = newParentId;
    while (currentParentId) {
      if (currentParentId === itemId) {
         throw new BadRequestException('Circular dependency detected');
      }
      const parent = await this.repo.getWorkItemById(currentParentId);
      if (!parent) break;
      currentParentId = parent.parent_id;
    }
  }

  async remove(userId: string, id: string) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');
    await this.projectsService.assertProjectMember(item.project_id, userId);
    await this.repo.deleteWorkItem(id, userId);
    return { success: true };
  }

  async getComments(userId: string, id: string) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');
    await this.projectsService.assertProjectMember(item.project_id, userId);
    return await this.repo.getComments(id);
  }

  async addComment(userId: string, id: string, content: string) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');
    await this.projectsService.assertProjectMember(item.project_id, userId);
    return await this.repo.createComment(id, userId, content);
  }

  async updateComment(
    userId: string,
    id: string,
    commentId: string,
    content: string,
  ) {
    // Basic verification - checking project access
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');
    await this.projectsService.assertProjectMember(item.project_id, userId);

    // Repository method should check if user owns the comment
    return await this.repo.updateComment(commentId, userId, content);
  }

  async deleteComment(userId: string, id: string, commentId: string) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');
    await this.projectsService.assertProjectMember(item.project_id, userId);

    await this.repo.deleteComment(commentId, userId);
    return { success: true };
  }

  async getActivity(userId: string, id: string) {
    const item = await this.repo.getWorkItemById(id);
    if (!item) throw new NotFoundException('Work item not found');
    await this.projectsService.assertProjectMember(item.project_id, userId);
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
      assignedTo: item.assigned_to,
      createdBy: item.created_by,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      completedAt: item.completed_at,
      parentId: item.parent_id,
      iterationId: item.iteration_id,
      areaId: item.area_id,
      tags: item.tags || [],
    };
  }
}
