import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { QueriesRepository } from './queries.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';
import {
  createQuerySchema,
  updateQuerySchema,
  queryDefinitionSchema,
} from './dto/queries.dto.js';
import { validateQueryDefinition } from './dto/query-validation.js';

@Injectable()
export class QueriesService {
  constructor(
    private readonly repo: QueriesRepository,
    private readonly projectsService: ProjectsService,
    private readonly authz: AuthorizationService,
  ) {}

  async findAll(userId: string, projectId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.QUERY_VIEW);
    return this.repo.findAllByProject(projectId);
  }

  async recent(userId: string, projectId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.QUERY_VIEW);
    return this.repo.findRecent(projectId, userId);
  }

  async findOne(userId: string, projectId: string, id: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.QUERY_VIEW);
    const query = await this.repo.findOne(id);
    // Project-scope check: reject queries that belong to a different project
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

    this.assertValidDefinition(parsed.data.definition);

    await this.authz.requireProjectPermission(projectId, userId, Permission.QUERY_CREATE);
    return this.repo.create(projectId, userId, parsed.data);
  }

  async update(userId: string, projectId: string, id: string, data: any) {
    const parsed = updateQuerySchema.safeParse(data);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
      );

    if (parsed.data.definition !== undefined) {
      this.assertValidDefinition(parsed.data.definition);
    }

    await this.authz.requireProjectPermission(projectId, userId, Permission.QUERY_EDIT);
    const existing = await this.findOne(userId, projectId, id);

    // Shared queries are editable by any member with QUERY_EDIT;
    // personal queries are only editable by their owner.
    if (!existing.isShared && existing.createdBy !== userId) {
      throw new ForbiddenException('You can only edit your own queries');
    }

    return this.repo.update(id, parsed.data);
  }

  async remove(userId: string, projectId: string, id: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.QUERY_DELETE);
    const existing = await this.findOne(userId, projectId, id);

    // Shared queries can only be deleted by ADMIN/OWNER or the creator.
    // Personal queries can only be deleted by their owner.
    if (!existing.isShared && existing.createdBy !== userId) {
      throw new ForbiddenException('You can only delete your own queries');
    }

    if (existing.isShared) {
      // For shared queries, require at least ADMIN role to delete
      const membership = await this.authz.requireProjectPermission(
        projectId,
        userId,
        Permission.QUERY_DELETE,
      );
      // Non-owners can only delete their own shared queries
      if (membership.role === 'MEMBER' && existing.createdBy !== userId) {
        throw new ForbiddenException('Only ADMIN or OWNER can delete shared queries created by others');
      }
    }

    await this.repo.remove(id);
    return { success: true };
  }

  async runSaved(userId: string, projectId: string, id: string) {
    const query = await this.findOne(userId, projectId, id);
    return this.runDefinition(userId, projectId, query.definition, query.id);
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

    this.assertValidDefinition(parsed.data);
    return this.runDefinition(userId, projectId, parsed.data, null);
  }

  private assertValidDefinition(definition: any) {
    try {
      validateQueryDefinition(definition);
    } catch (errors) {
      const messages = Array.isArray(errors) ? errors : [String(errors)];
      throw new BadRequestException(messages);
    }
  }

  private async runDefinition(
    userId: string,
    projectId: string,
    definition: any,
    queryId: string | null,
  ) {
    // Require view permission — queries run on project-scoped data only
    await this.authz.requireProjectPermission(projectId, userId, Permission.QUERY_VIEW);
    const project = await this.projectsService.assertProjectMember(projectId, userId);

    const parsed = queryDefinitionSchema.safeParse(definition);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
      );

    this.assertValidDefinition(parsed.data);

    // The repo.execute call always receives projectId from the validated server
    // side — never from the query definition itself, preventing cross-project leaks
    const rows = await this.repo.execute(
      projectId,
      parsed.data,
      userId,
      project.key,
    );
    await this.repo.recordRun(projectId, queryId, userId, parsed.data);
    return rows;
  }

  async duplicate(userId: string, projectId: string, id: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.QUERY_CREATE);
    const existing = await this.findOne(userId, projectId, id);
    return this.repo.create(projectId, userId, {
      name: `Copy of ${existing.name}`,
      description: existing.description,
      isShared: false,
      folder: existing.folder,
      definition: existing.definition,
    });
  }
}