import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IterationsRepository } from './iterations.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import {
  CreateIterationDto,
  UpdateIterationDto,
  AddWorkItemsDto,
} from './dto/iterations.dto.js';

@Injectable()
export class IterationsService {
  constructor(
    private readonly repo: IterationsRepository,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(userId: string, projectId: string, data: CreateIterationDto) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const iteration = await this.repo.create(projectId, data);
    await this.repo.addHistory(iteration.id, userId, 'CREATED');
    return iteration;
  }

  async findAllByProject(userId: string, projectId: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    return this.repo.findAllByProject(projectId);
  }

  async findOne(userId: string, projectId: string, id: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const iteration = await this.repo.findOne(id);
    if (!iteration || iteration.projectId !== projectId)
      throw new NotFoundException('Iteration not found');
    return iteration;
  }

  async update(
    userId: string,
    projectId: string,
    id: string,
    data: UpdateIterationDto,
  ) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const iteration = await this.repo.findOne(id);
    if (!iteration || iteration.projectId !== projectId)
      throw new NotFoundException('Iteration not found');

    if (data.state === 'ACTIVE') {
      const activeIteration = await this.repo.findActiveSprintByProject(projectId);
      if (activeIteration && activeIteration.id !== id) {
        throw new BadRequestException('Project already has an active iteration');
      }
    }

    const updated = await this.repo.update(id, data);

    const fieldMappings: Array<[keyof UpdateIterationDto, string, string]> = [
      ['name', 'iteration', 'NAME_CHANGED'],
      ['goal', 'goal', 'GOAL_CHANGED'],
      ['state', 'state', 'STATE_CHANGED'],
    ];

    for (const [field, dbField, action] of fieldMappings) {
      if (
        data[field] !== undefined &&
        String(iteration[field] ?? '') !== String(data[field])
      ) {
        await this.repo.addHistory(
          id,
          userId,
          action,
          dbField,
          iteration[field] != null ? String(iteration[field]) : null,
          data[field] != null ? String(data[field]) : null,
        );
      }
    }

    if (
      (data.startDate !== undefined && data.startDate !== iteration.startDate.toISOString()) ||
      (data.endDate !== undefined && data.endDate !== iteration.endDate.toISOString())
    ) {
      await this.repo.addHistory(
        id,
        userId,
        'DATE_CHANGED',
        'date',
        iteration.startDate?.toISOString?.() ?? null,
        data.startDate ?? data.endDate ?? null,
      );
    }

    return updated;
  }

  async remove(userId: string, projectId: string, id: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const iteration = await this.repo.findOne(id);
    if (!iteration || iteration.projectId !== projectId)
      throw new NotFoundException('Iteration not found');

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
    const iteration = await this.repo.findOne(id);
    if (!iteration || iteration.projectId !== projectId)
      throw new NotFoundException('Iteration not found');

    await this.repo.addWorkItems(id, data.workItemIds, userId);
    return { success: true };
  }

  async removeWorkItem(
    userId: string,
    projectId: string,
    iterationId: string,
    workItemId: string,
  ) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const iteration = await this.repo.findOne(iterationId);
    if (!iteration || iteration.projectId !== projectId)
      throw new NotFoundException('Iteration not found');

    await this.repo.removeWorkItem(workItemId, userId);
    return { success: true };
  }

  async getSprintWorkItems(userId: string, projectId: string, id: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const iteration = await this.repo.findOne(id);
    if (!iteration || iteration.projectId !== projectId)
      throw new NotFoundException('Iteration not found');

    const items = await this.repo.getSprintWorkItems(id);
    const project = await this.projectsService.findOne(userId, projectId);

    return items.map((item) => ({
      ...item,
      key: `${project.key}-${item.seqNo}`,
    }));
  }
}
