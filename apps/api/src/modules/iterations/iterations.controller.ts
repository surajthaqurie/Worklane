import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../projects/auth.guard.js';
import { IterationsService } from './iterations.service.js';
import {
  CreateIterationDto,
  UpdateIterationDto,
  AddWorkItemsDto,
  CompleteIterationDto,
  BulkMoveWorkItemsDto,
} from './dto/iterations.dto.js';

@Controller('projects/:projectId/iterations')
@UseGuards(AuthGuard)
export class IterationsController {
  constructor(private readonly iterationsService: IterationsService) {}

  private uid(req: any): string {
    return req.user.id;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  @Post()
  create(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: CreateIterationDto,
  ) {
    return this.iterationsService.create(this.uid(req), projectId, dto);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.iterationsService.findAllByProject(this.uid(req), projectId, teamId);
  }

  @Get(':id')
  findOne(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.iterationsService.findOne(this.uid(req), projectId, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIterationDto,
  ) {
    return this.iterationsService.update(this.uid(req), projectId, id, dto);
  }

  @Delete(':id')
  remove(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.iterationsService.remove(this.uid(req), projectId, id);
  }

  // ─── State transitions ────────────────────────────────────────────────────

  /**
   * POST /projects/:projectId/iterations/:id/activate
   * Starts a sprint. Only one active sprint is allowed per project.
   */
  @Post(':id/activate')
  activate(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.iterationsService.activate(this.uid(req), projectId, id);
  }

  /**
   * POST /projects/:projectId/iterations/:id/complete
   * Completes a sprint. Explicitly handles unfinished work.
   * Body: { incompleteAction: 'MOVE_TO_NEXT' | 'MOVE_TO_BACKLOG', targetIterationId?: string }
   */
  @Post(':id/complete')
  complete(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: CompleteIterationDto,
  ) {
    return this.iterationsService.completeIteration(this.uid(req), projectId, id, dto);
  }

  // ─── Sprint backlog ───────────────────────────────────────────────────────

  /**
   * GET /projects/:projectId/iterations/:id/backlog
   * Returns enriched work items for the sprint (assignee name, area, key).
   */
  @Get(':id/backlog')
  getBacklog(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.iterationsService.getSprintBacklog(this.uid(req), projectId, id, teamId);
  }

  // ─── Sprint board ──────────────────────────────────────────────────────────

  /**
   * GET /projects/:projectId/iterations/:id/board
   * Returns the sprint board: work items assigned to this iteration grouped by
   * the project's workflow states (including empty columns).
   */
  @Get(':id/board')
  getBoard(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.iterationsService.getSprintBoard(this.uid(req), projectId, id, teamId);
  }

  // ─── Work item assignment ─────────────────────────────────────────────────

  @Post(':id/work-items')
  addWorkItems(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: AddWorkItemsDto,
  ) {
    return this.iterationsService.addWorkItems(this.uid(req), projectId, id, dto);
  }

  @Delete(':id/work-items/:workItemId')
  removeWorkItem(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Param('workItemId') workItemId: string,
  ) {
    return this.iterationsService.removeWorkItem(
      this.uid(req),
      projectId,
      id,
      workItemId,
    );
  }

  /**
   * POST /projects/:projectId/iterations/:id/work-items/bulk-move
   * Move multiple work items to another iteration or back to the backlog.
   * Body: { workItemIds: string[], targetIterationId: string | null }
   */
  @Post(':id/work-items/bulk-move')
  bulkMoveWorkItems(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: BulkMoveWorkItemsDto,
  ) {
    return this.iterationsService.bulkMoveWorkItems(this.uid(req), projectId, id, dto);
  }

  // ─── Legacy work items endpoint (kept for board compat) ──────────────────

  @Get(':id/work-items')
  getWorkItems(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.iterationsService.getSprintWorkItems(this.uid(req), projectId, id);
  }
}
