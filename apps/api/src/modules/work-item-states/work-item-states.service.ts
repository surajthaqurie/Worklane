import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { WorkItemStatesRepository } from './work-item-states.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import {
  CreateWorkItemStateDto,
  UpdateWorkItemStateDto,
} from './dto/work-item-states.dto.js';
import { db } from '../../db/kysely.js';

@Injectable()
export class WorkItemStatesService {
  constructor(
    private readonly repo: WorkItemStatesRepository,
    private readonly projectsService: ProjectsService,
  ) {}

  async findAll(userId: string, projectId: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    return this.repo.findAll(projectId);
  }

  async create(userId: string, projectId: string, data: CreateWorkItemStateDto) {
    await this.projectsService.assertProjectMember(projectId, userId);

    if (!data.name || !data.name.trim()) {
      throw new BadRequestException('State name is required');
    }

    const key = this.generateKey(data.name);
    const existing = await this.repo.findByKey(projectId, key);
    if (existing) {
      throw new BadRequestException(
        `A state with the name "${data.name}" already exists`,
      );
    }

    return this.repo.create(projectId, {
      name: data.name.trim(),
      key,
      color: data.color || '#94A3B8',
      isDone: data.isDone ?? false,
    });
  }

  async update(
    userId: string,
    projectId: string,
    id: string,
    data: UpdateWorkItemStateDto,
  ) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const state = await this.repo.findById(id);
    if (!state || state.projectId !== projectId) {
      throw new NotFoundException('State not found');
    }
    return this.repo.update(id, {
      name: data.name?.trim() || undefined,
      color: data.color,
      isDone: data.isDone,
      sortOrder: data.sortOrder,
    });
  }

  async remove(userId: string, projectId: string, id: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const state = await this.repo.findById(id);
    if (!state || state.projectId !== projectId) {
      throw new NotFoundException('State not found');
    }

    const count = await this.repo.countByProject(projectId);
    if (count <= 1) {
      throw new BadRequestException('A project must keep at least one state');
    }

    const remaining = (await this.repo.findAll(projectId)).filter(
      (s) => s.id !== id,
    );
    const fallback = remaining[0];
    if (!fallback) {
      throw new BadRequestException('A project must keep at least one state');
    }

    const affectedItems = await this.repo.findWorkItemsInState(
      projectId,
      state.key,
    );

    if (affectedItems.length > 0) {
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable('work_items')
          .set({ state: fallback.key, updated_at: new Date() })
          .where('project_id', '=', projectId)
          .where('state', '=', state.key)
          .execute();

        await trx
          .insertInto('work_item_history')
          .values(
            affectedItems.map((item) => ({
              work_item_id: item.id,
              user_id: userId,
              action: 'STATE_CHANGED',
              field: 'state',
              old_value: state.key,
              new_value: fallback.key,
            })),
          )
          .execute();
      });
    }

    await this.repo.remove(id);
    return { success: true };
  }

  async reorder(userId: string, projectId: string, orderedIds: string[]) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const current = await this.repo.findAll(projectId);
    const currentIds = new Set(current.map((s) => s.id));

    if (
      orderedIds.length !== current.length ||
      orderedIds.some((id) => !currentIds.has(id))
    ) {
      throw new BadRequestException('Ordered state list must match all states');
    }

    await this.repo.updateSortedOrder(projectId, orderedIds);
    return { success: true };
  }

  private generateKey(name: string): string {
    const base = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return base || 'STATE';
  }
}