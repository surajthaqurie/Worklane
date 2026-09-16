import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SprintsRepository } from './sprints.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import {
  CreateSprintDto,
  UpdateSprintDto,
  AddWorkItemsDto,
} from './dto/sprints.dto.js';

@Injectable()
export class SprintsService {
  constructor(
    private readonly repo: SprintsRepository,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(userId: string, projectId: string, data: CreateSprintDto) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const sprint = await this.repo.create(projectId, data);
    await this.repo.addHistory(sprint.id, userId, 'CREATED');
    return sprint;
  }

  async findAllByProject(userId: string, projectId: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    return this.repo.findAllByProject(projectId);
  }

  async findOne(userId: string, projectId: string, id: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const sprint = await this.repo.findOne(id);
    if (!sprint || sprint.projectId !== projectId)
      throw new NotFoundException('Sprint not found');
    return sprint;
  }

  async update(
    userId: string,
    projectId: string,
    id: string,
    data: UpdateSprintDto,
  ) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const sprint = await this.repo.findOne(id);
    if (!sprint || sprint.projectId !== projectId)
      throw new NotFoundException('Sprint not found');

    if (data.state === 'ACTIVE') {
      const activeSprint = await this.repo.findActiveSprintByProject(projectId);
      if (activeSprint && activeSprint.id !== id) {
        throw new BadRequestException('Project already has an active sprint');
      }
    }

    const updated = await this.repo.update(id, data);

    const fieldMappings: Array<[keyof UpdateSprintDto, string, string]> = [
      ['name', 'sprint', 'NAME_CHANGED'],
      ['goal', 'goal', 'GOAL_CHANGED'],
      ['state', 'state', 'STATE_CHANGED'],
    ];

    for (const [field, dbField, action] of fieldMappings) {
      if (
        data[field] !== undefined &&
        String(sprint[field] ?? '') !== String(data[field])
      ) {
        await this.repo.addHistory(
          id,
          userId,
          action,
          dbField,
          sprint[field] != null ? String(sprint[field]) : null,
          data[field] != null ? String(data[field]) : null,
        );
      }
    }

    if (
      (data.startDate !== undefined && data.startDate !== sprint.startDate.toISOString()) ||
      (data.endDate !== undefined && data.endDate !== sprint.endDate.toISOString())
    ) {
      await this.repo.addHistory(
        id,
        userId,
        'DATE_CHANGED',
        'date',
        sprint.startDate?.toISOString?.() ?? null,
        data.startDate ?? data.endDate ?? null,
      );
    }

    return updated;
  }

  async remove(userId: string, projectId: string, id: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const sprint = await this.repo.findOne(id);
    if (!sprint || sprint.projectId !== projectId)
      throw new NotFoundException('Sprint not found');

    await this.repo.addHistory(id, userId, 'DELETED');
    await this.repo.remove(id);
    return { success: true };
  }

  async addWorkItems(
    userId: string,
    projectId: string,
    id: string,
    data: AddWorkItemsDto,
  ) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const sprint = await this.repo.findOne(id);
    if (!sprint || sprint.projectId !== projectId)
      throw new NotFoundException('Sprint not found');

    await this.repo.addWorkItems(id, data.workItemIds, userId);
    return { success: true };
  }

  async removeWorkItem(
    userId: string,
    projectId: string,
    sprintId: string,
    workItemId: string,
  ) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const sprint = await this.repo.findOne(sprintId);
    if (!sprint || sprint.projectId !== projectId)
      throw new NotFoundException('Sprint not found');

    await this.repo.removeWorkItem(workItemId, userId);
    return { success: true };
  }

  async getSprintWorkItems(userId: string, projectId: string, id: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const sprint = await this.repo.findOne(id);
    if (!sprint || sprint.projectId !== projectId)
      throw new NotFoundException('Sprint not found');

    const items = await this.repo.getSprintWorkItems(id);
    const project = await this.projectsService.findOne(userId, projectId);

    return items.map((item) => ({
      ...item,
      key: `${project.key}-${item.seqNo}`,
    }));
  }
}
