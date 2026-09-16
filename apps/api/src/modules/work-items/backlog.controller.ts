import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../projects/auth.guard.js';
import { BacklogRepository, ReorderPayload } from './backlog.repository.js';
import { ProjectsService } from '../projects/projects.service.js';

class ReorderDto {
  id: string;
  parentId: string | null;
  newRank: number;
}

class BulkAssignIterationDto {
  itemIds: string[];
  iterationId: string | null;
}

@Controller()
@UseGuards(AuthGuard)
export class BacklogController {
  constructor(
    private readonly backlogRepo: BacklogRepository,
    private readonly projectsService: ProjectsService,
  ) {}

  /**
   * GET /projects/:projectId/backlog
   *
   * Returns a paginated, filtered list of work items for a given hierarchical level.
   * Pass `parentId=null` (or omit) for top-level items.
   * Pass `parentId=<uuid>` to load children of that item.
   *
   * This is NOT the same as the board endpoint. The backlog is about hierarchy
   * and planning; the board is about workflow/state.
   */
  @Get('projects/:projectId/backlog')
  async getBacklog(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Query('parentId') parentId?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('state') state?: string,
    @Query('priority') priority?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('iterationId') iterationId?: string,
    @Query('areaId') areaId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const project = await this.projectsService.assertProjectMember(projectId, req.user.id);

    // Resolve parentId: 'null' string → null, undefined → null (top level), else string uuid
    let resolvedParentId: string | null;
    if (parentId === undefined || parentId === 'null' || parentId === '') {
      resolvedParentId = null;
    } else {
      resolvedParentId = parentId;
    }

    return this.backlogRepo.getBacklogTree(
      projectId,
      {
        parentId: resolvedParentId,
        search,
        type,
        state,
        priority,
        assignedTo,
        iterationId,
        areaId,
        limit: limit ? parseInt(limit, 10) : 100,
        offset: offset ? parseInt(offset, 10) : 0,
      },
      project.key,
    );
  }

  /**
   * POST /projects/:projectId/backlog/reorder
   *
   * Persists a drag-and-drop reorder event from the backlog.
   * Accepts the new fractional rank and optional parent change.
   * Records history for both parent change and ordering change.
   */
  @Post('projects/:projectId/backlog/reorder')
  async reorder(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Body() dto: ReorderDto,
  ) {
    await this.projectsService.assertProjectMember(projectId, req.user.id);

    if (!dto.id) throw new BadRequestException('id is required');
    if (dto.newRank === undefined || dto.newRank === null) {
      throw new BadRequestException('newRank is required');
    }

    await this.backlogRepo.reorderItem(projectId, req.user.id, {
      id: dto.id,
      parentId: dto.parentId ?? null,
      newRank: dto.newRank,
    });

    return { success: true };
  }

  /**
   * POST /projects/:projectId/backlog/bulk-assign-iteration
   *
   * Efficiently assigns (or clears) an iteration for multiple work items.
   * Used when dragging items into sprint slots in the planning panel.
   */
  @Post('projects/:projectId/backlog/bulk-assign-iteration')
  async bulkAssignIteration(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Body() dto: BulkAssignIterationDto,
  ) {
    await this.projectsService.assertProjectMember(projectId, req.user.id);

    if (!Array.isArray(dto.itemIds) || dto.itemIds.length === 0) {
      throw new BadRequestException('itemIds must be a non-empty array');
    }

    await this.backlogRepo.bulkAssignIteration(
      projectId,
      req.user.id,
      dto.itemIds,
      dto.iterationId ?? null,
    );

    return { success: true };
  }
}
