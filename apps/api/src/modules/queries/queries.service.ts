import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { QueriesRepository } from './queries.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import {
  createQuerySchema,
  updateQuerySchema,
  queryDefinitionSchema,
} from './dto/queries.dto.js';

@Injectable()
export class QueriesService {
  constructor(
    private readonly repo: QueriesRepository,
    private readonly projectsService: ProjectsService,
  ) {}

  async findAll(userId: string, projectId: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    return this.repo.findAllByProject(projectId);
  }

  async findOne(userId: string, projectId: string, id: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const query = await this.repo.findOne(id);
    if (!query || query.projectId !== projectId)
      throw new NotFoundException('Query not found');
    return query;
  }

  async create(userId: string, projectId: string, data: any) {
    const parsed = createQuerySchema.safeParse(data);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
      );

    await this.projectsService.assertProjectMember(projectId, userId);
    return this.repo.create(projectId, userId, parsed.data);
  }

  async update(userId: string, projectId: string, id: string, data: any) {
    const parsed = updateQuerySchema.safeParse(data);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
      );

    await this.projectsService.assertProjectMember(projectId, userId);
    const existing = await this.findOne(userId, projectId, id);

    // Shared queries are editable by any member; personal only by owner.
    if (!existing.isShared && existing.createdBy !== userId) {
      throw new ForbiddenException('You can only edit your own queries');
    }

    return this.repo.update(id, parsed.data);
  }

  async remove(userId: string, projectId: string, id: string) {
    await this.projectsService.assertProjectMember(projectId, userId);
    const existing = await this.findOne(userId, projectId, id);

    if (!existing.isShared && existing.createdBy !== userId) {
      throw new ForbiddenException('You can only delete your own queries');
    }

    await this.repo.remove(id);
    return { success: true };
  }

  async runSaved(userId: string, projectId: string, id: string) {
    const query = await this.findOne(userId, projectId, id);
    return this.runDefinition(userId, projectId, query.definition);
  }

  async runAdhoc(userId: string, projectId: string, definition: any) {
    if (definition === undefined) {
      definition = { filters: [] };
    }
    const parsed = queryDefinitionSchema.safeParse(definition);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
      );

    return this.runDefinition(userId, projectId, parsed.data);
  }

  private async runDefinition(
    userId: string,
    projectId: string,
    definition: any,
  ) {
    const project = await this.projectsService.assertProjectMember(
      projectId,
      userId,
    );
    return this.repo.execute(projectId, definition, userId, project.key);
  }
}