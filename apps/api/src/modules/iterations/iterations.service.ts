import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { IterationsRepository } from './iterations.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import {
  CreateIterationDto,
  UpdateIterationDto,
  AddWorkItemsDto,
  CompleteIterationDto,
  BulkMoveWorkItemsDto,
} from './dto/iterations.dto.js';

@Injectable()
export class IterationsService {
  constructor(
    private readonly repo: IterationsRepository,
    private readonly projectsService: ProjectsService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(userId: string, projectId: string, data: CreateIterationDto) {
    await this.projectsService.assertProjectMember(projectId, userId);

    // Validate dates
    this.repo.validateDates(data.startDate, data.endDate);

    // Check for overlap within same parent scope
    await this.repo.checkDateOverlap(
      projectId,
      data.startDate,
      data.endDate,
      data.parentId ?? null,
    );

    const iteration = await this.repo.create(projectId, data);
    await this.repo.addHistory(iteration.id, userId, 'CREATED');
    return iteration;
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  async findAllByProject(userId: string, projectId: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    return this.repo.findAllByProject(projectId);
  }

  // ─── Single ───────────────────────────────────────────────────────────────

  async findOne(userId: string, projectId: string, id: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const iteration = await this.repo.findOne(id);
    if (!iteration || iteration.projectId !== projectId) {
      throw new NotFoundException('Iteration not found');
    }
    return iteration;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(userId: string, projectId: string, id: string, data: UpdateIterationDto) {
    await this.projectsService.assertProjectMember(projectId, userId);

    const iteration = await this.repo.findOne(id);
    if (!iteration || iteration.projectId !== projectId) {
      throw new NotFoundException('Iteration not found');
    }

    // Forbid state changes via update — use dedicated activate/complete endpoints
    if (data.state !== undefined) {
      throw new BadRequestException(
        'Use the /activate or /complete endpoints to change sprint state',
      );
    }

    // Validate dates when changing either boundary
    const newStart = data.startDate ?? iteration.startDate.toISOString();
    const newEnd = data.endDate ?? iteration.endDate.toISOString();
    if (data.startDate !== undefined || data.endDate !== undefined) {
      this.repo.validateDates(newStart, newEnd);
      await this.repo.checkDateOverlap(
        projectId,
        newStart,
        newEnd,
        data.parentId !== undefined ? (data.parentId ?? null) : iteration.parentId,
        id, // exclude self
      );
    }

    const updated = await this.repo.update(id, data);

    // History
    const fieldMappings: Array<[keyof UpdateIterationDto, string, string]> = [
      ['name', 'name', 'NAME_CHANGED'],
      ['goal', 'goal', 'GOAL_CHANGED'],
    ];
    for (const [field, dbField, action] of fieldMappings) {
      if (
        data[field] !== undefined &&
        String(iteration[field as keyof typeof iteration] ?? '') !== String(data[field])
      ) {
        await this.repo.addHistory(
          id,
          userId,
          action,
          dbField,
          iteration[field as keyof typeof iteration] != null
            ? String(iteration[field as keyof typeof iteration])
            : null,
          data[field] != null ? String(data[field]) : null,
        );
      }
    }
    if (data.startDate !== undefined || data.endDate !== undefined) {
      await this.repo.addHistory(
        id,
        userId,
        'DATE_CHANGED',
        'date',
        `${iteration.startDate} - ${iteration.endDate}`,
        `${newStart} - ${newEnd}`,
      );
    }

    return updated;
  }

  // ─── Activate ─────────────────────────────────────────────────────────────

  async activate(userId: string, projectId: string, id: string) {
    await this.projectsService.assertProjectMember(projectId, userId);

    const iteration = await this.repo.findOne(id);
    if (!iteration || iteration.projectId !== projectId) {
      throw new NotFoundException('Iteration not found');
    }
    if (iteration.state === 'COMPLETED') {
      throw new BadRequestException('Cannot activate a completed iteration');
    }
    if (iteration.state === 'ACTIVE') {
      return iteration; // idempotent
    }

    // Only one active sprint per project
    const active = await this.repo.findActiveByProject(projectId);
    if (active && active.id !== id) {
      throw new BadRequestException(
        `Sprint "${active.name}" is already active. Complete it before starting a new sprint.`,
      );
    }

    const updated = await this.repo.update(id, { state: 'ACTIVE' });
    await this.repo.addHistory(id, userId, 'ACTIVATED', 'state', 'PLANNED', 'ACTIVE');
    return updated;
  }

  // ─── Complete ─────────────────────────────────────────────────────────────

  async completeIteration(
    userId: string,
    projectId: string,
    id: string,
    opts: CompleteIterationDto,
  ) {
    await this.projectsService.assertProjectMember(projectId, userId);

    const iteration = await this.repo.findOne(id);
    if (!iteration || iteration.projectId !== projectId) {
      throw new NotFoundException('Iteration not found');
    }
    if (iteration.state !== 'ACTIVE') {
      throw new BadRequestException('Only active iterations can be completed');
    }

    // If moving to a specific iteration, validate it exists and belongs to this project
    if (opts.incompleteAction === 'MOVE_TO_NEXT') {
      if (!opts.targetIterationId) {
        throw new BadRequestException(
          'targetIterationId is required when incompleteAction is MOVE_TO_NEXT',
        );
      }
      const target = await this.repo.findOne(opts.targetIterationId);
      if (!target || target.projectId !== projectId) {
        throw new NotFoundException('Target iteration not found');
      }
      if (target.state === 'COMPLETED') {
        throw new BadRequestException('Cannot move items to a completed iteration');
      }
    }

    // Complete the iteration — returns incomplete items WITHOUT losing them
    const { incompleteItems } = await this.repo.completeIteration(id, userId);

    let movedCount = 0;

    if (incompleteItems.length > 0) {
      const incompleteIds = incompleteItems.map((i) => i.id);

      if (opts.incompleteAction === 'MOVE_TO_NEXT' && opts.targetIterationId) {
        await this.repo.moveItemsToIteration(incompleteIds, opts.targetIterationId, userId);
      } else {
        // MOVE_TO_BACKLOG — set iteration_id = null
        await this.repo.moveItemsToIteration(incompleteIds, null, userId);
      }

      movedCount = incompleteItems.length;
    }

    const updated = await this.repo.findOne(id);

    return {
      iteration: updated,
      movedCount,
      incompleteItems,
    };
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async remove(userId: string, projectId: string, id: string) {
    await this.projectsService.assertProjectMember(projectId, userId);

    const iteration = await this.repo.findOne(id);
    if (!iteration || iteration.projectId !== projectId) {
      throw new NotFoundException('Iteration not found');
    }

    await this.repo.addHistory(id, userId, 'DELETED');
    await this.repo.remove(id);
    return { success: true };
  }

  // ─── Work item management ─────────────────────────────────────────────────

  async addWorkItems(userId: string, projectId: string, id: string, data: AddWorkItemsDto) {
    await this.projectsService.assertProjectMember(projectId, userId);

    const iteration = await this.repo.findOne(id);
    if (!iteration || iteration.projectId !== projectId) {
      throw new NotFoundException('Iteration not found');
    }

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
    if (!iteration || iteration.projectId !== projectId) {
      throw new NotFoundException('Iteration not found');
    }

    await this.repo.removeWorkItem(workItemId, userId);
    return { success: true };
  }

  async bulkMoveWorkItems(
    userId: string,
    projectId: string,
    iterationId: string,
    data: BulkMoveWorkItemsDto,
  ) {
    await this.projectsService.assertProjectMember(projectId, userId);

    const iteration = await this.repo.findOne(iterationId);
    if (!iteration || iteration.projectId !== projectId) {
      throw new NotFoundException('Iteration not found');
    }

    if (data.targetIterationId) {
      const target = await this.repo.findOne(data.targetIterationId);
      if (!target || target.projectId !== projectId) {
        throw new NotFoundException('Target iteration not found');
      }
    }

    await this.repo.moveItemsToIteration(data.workItemIds, data.targetIterationId, userId);
    return { success: true, movedCount: data.workItemIds.length };
  }

  // ─── Sprint backlog (enriched) ────────────────────────────────────────────

  async getSprintBacklog(userId: string, projectId: string, id: string) {
    await this.projectsService.assertProjectMember(projectId, userId);

    const iteration = await this.repo.findOne(id);
    if (!iteration || iteration.projectId !== projectId) {
      throw new NotFoundException('Iteration not found');
    }

    const project = await this.projectsService.findOne(userId, projectId);
    return this.repo.getSprintWorkItems(id, project.key);
  }

  // ─── Legacy (kept for board compatibility) ────────────────────────────────

  async getSprintWorkItems(userId: string, projectId: string, id: string) {
    return this.getSprintBacklog(userId, projectId, id);
  }
}
