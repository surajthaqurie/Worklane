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
    const item = await this.repo.createWorkItem(projectId, userId, data);
    return this.mapWorkItem(item, project.key);
  }

  async findAll(userId: string, projectId: string, filters: any) {
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
    if (data.state !== undefined) {
      const allowedStates = await this.repo.getProjectStateKeys(
        item.project_id,
      );
      if (!allowedStates.includes(data.state)) {
        throw new BadRequestException(`State "${data.state}" is not valid for this project`);
      }
    }
    const updated = await this.repo.updateWorkItem(id, userId, data);
    return this.mapWorkItem(updated, project.key);
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
      sprintId: item.sprint_id,
    };
  }
}
