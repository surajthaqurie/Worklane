import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IterationsRepository } from './iterations.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { TeamsService } from '../teams/teams.service.js';
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
    private readonly teamsService: TeamsService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(userId: string, projectId: string, data: CreateIterationDto) {
    await this.projectsService.assertProjectMember(projectId, userId);

    // Validate dates
    this.repo.validateDates(data.startDate, data.endDate);

    // A parent iteration must belong to the same project and stay within depth limits
    if (data.parentId) {
      await this.repo.validateParent(projectId, data.parentId);
    }

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

  async findAllByProject(userId: string, projectId: string, teamId?: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const all = await this.repo.findAllByProject(projectId);
    if (!teamId || teamId === 'default' || teamId === 'undefined') return all;
    await this.teamsService.assertTeamMember(projectId, teamId, userId);
    const scope = await this.teamsService.getTeamScope(projectId, teamId);
    const selected = new Set(scope.iterationIds);
    return all.filter((it) => selected.has(it.id));
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

    // Validate parent hierarchy changes (same project, no cycles, depth limit)
    if (data.parentId !== undefined && (data.parentId ?? null) !== null) {
      await this.repo.validateParent(projectId, data.parentId!, id);
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
    if (
      data.parentId !== undefined &&
      (data.parentId ?? null) !== iteration.parentId
    ) {
      await this.repo.addHistory(
        id,
        userId,
        'PARENT_CHANGED',
        'parent_id',
        iteration.parentId,
        data.parentId ?? null,
      );
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

    if (opts.targetIterationId && opts.targetIterationId === id) {
      throw new BadRequestException(
        'Cannot move incomplete items into the iteration being completed',
      );
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

    if (iteration.state === 'ACTIVE') {
      throw new BadRequestException(
        'Cannot delete an active iteration. Complete it before deleting.',
      );
    }

    const childCount = await this.repo.countChildren(id);
    if (childCount > 0) {
      throw new BadRequestException(
        'Cannot delete an iteration that has child iterations. Move or delete the children first.',
      );
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

    await this.repo.removeWorkItem(iterationId, workItemId, userId);
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

    // No-op if source and target are the same iteration
    if (!data.targetIterationId || data.targetIterationId === iterationId) {
      return { success: true, movedCount: 0 };
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

  async getSprintBacklog(userId: string, projectId: string, id: string, teamId?: string) {
    await this.projectsService.assertProjectMember(projectId, userId);

    const iteration = await this.repo.findOne(id);
    if (!iteration || iteration.projectId !== projectId) {
      throw new NotFoundException('Iteration not found');
    }

    const project = await this.projectsService.findOne(userId, projectId);
    const areaIds = await this.resolveTeamScope(userId, projectId, teamId, iteration);
    return this.repo.getSprintWorkItems(id, project.key, areaIds);
  }

  // ─── Sprint board (grouped by workflow state) ─────────────────────────────

  /**
   * Returns the sprint board: the same work items assigned to this iteration as
   * the backlog, grouped by the project's workflow state. Empty state columns
   * are included so the frontend renders the full workflow.
   */
  async getSprintBoard(userId: string, projectId: string, id: string, teamId?: string) {
    await this.projectsService.assertProjectMember(projectId, userId);

    const iteration = await this.repo.findOne(id);
    if (!iteration || iteration.projectId !== projectId) {
      throw new NotFoundException('Iteration not found');
    }

    const project = await this.projectsService.findOne(userId, projectId);
    const areaIds = await this.resolveTeamScope(userId, projectId, teamId, iteration);
    const [items, states] = await Promise.all([
      this.repo.getSprintWorkItems(id, project.key, areaIds),
      this.repo.getWorkflowStates(projectId),
    ]);

    const groups = states.map((state) => ({
      state,
      items: items.filter((item) => item.state === state.key),
    }));

    return {
      iteration,
      states,
      groups,
      total: items.length,
    };
  }

  /**
   * When a team is selected, verify membership and that the sprint belongs to
   * the team's configured iterations, then return the team's area filter.
   */
  private async resolveTeamScope(
    userId: string,
    projectId: string,
    teamId: string | undefined,
    iteration: { id: string },
  ): Promise<string[] | undefined> {
    if (!teamId || teamId === 'default' || teamId === 'undefined') return undefined;
    await this.teamsService.assertTeamMember(projectId, teamId, userId);
    const scope = await this.teamsService.getTeamScope(projectId, teamId);
    if (!scope.iterationIds.includes(iteration.id)) {
      throw new NotFoundException('Iteration not found');
    }
    return scope.areaIds.length > 0 ? scope.areaIds : undefined;
  }

  // ─── Legacy (kept for board compatibility) ────────────────────────────────

  async getSprintWorkItems(userId: string, projectId: string, id: string) {
    return this.getSprintBacklog(userId, projectId, id);
  }
}
