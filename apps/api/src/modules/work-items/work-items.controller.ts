import { WorkItemFilterDto } from "./dto/filter.dto.js";
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkItemsService } from './work-items.service.js';
import { CreateWorkItemDto, UpdateWorkItemDto } from './dto/work-items.dto.js';
import { StateTransitionDto } from './dto/state-transition.dto.js';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { WorkItemTransitionsService } from './work-item-transitions.service.js';
import {
  createCommentSchema,
  updateCommentSchema,
  deleteCommentSchema,
  commentPageSchema,
  parseCommentInput,
} from './dto/comments.dto.js';

@Controller()
@UseGuards(AuthGuard)
export class WorkItemsController {
  constructor(
    private readonly workItemsService: WorkItemsService,
    private readonly transitionsService: WorkItemTransitionsService
  ) {}

  @Get('projects/:projectId/work-item-types')
  getTypeDefinitions() {
    return this.workItemsService.getTypeDefinitions();
  }

  @Post('projects/:projectId/work-items')
  create(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Body() createDto: CreateWorkItemDto,
  ) {
    return this.workItemsService.create(req.user.id, projectId, createDto);
  }

  @Get('projects/:projectId/work-items')
  findAll(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Query() query: WorkItemFilterDto,
  ) {
    return this.workItemsService.findAll(req.user.id, projectId, query);
  }

  @Get('projects/:projectId/work-items/rollups')
  getBatchRollups(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Query('ids') ids?: string,
  ) {
    const itemIds = ids ? ids.split(',').filter(Boolean) : [];
    return this.workItemsService.getBatchWorkItemRollups(req.user.id, projectId, itemIds);
  }

  @Get('projects/:projectId/work-items/:id/rollups')
  getRollup(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.workItemsService.getWorkItemRollup(req.user.id, projectId, id);
  }

  @Get('projects/:projectId/work-items/:id/hierarchy')
  getHierarchy(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.workItemsService.getWorkItemHierarchy(req.user.id, projectId, id);
  }

  @Get('work-items/:id')
  findOne(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.workItemsService.findOne(req.user.id, id);
  }

  @Patch('work-items/:id')
  update(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateDto: UpdateWorkItemDto,
  ) {
    return this.workItemsService.update(req.user.id, id, updateDto);
  }

  @Delete('work-items/:id')
  remove(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.workItemsService.remove(req.user.id, id);
  }

  @Patch('work-items/:id/state')
  async transitionState(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() transitionDto: StateTransitionDto,
  ) {
    return this.transitionsService.transitionState(
      req.user.id,
      id,
      transitionDto.state,
      transitionDto.expectedVersion,
    );
  }

  @Get('work-items/:id/comments')
  getComments(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = parseCommentInput(commentPageSchema, query);
    return this.workItemsService.getComments(req.user.id, id, parsed);
  }

  @Post('work-items/:id/comments')
  addComment(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = parseCommentInput(createCommentSchema, body);
    return this.workItemsService.addComment(req.user.id, id, parsed.content);
  }

  @Patch('work-items/:id/comments/:commentId')
  updateComment(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() body: unknown,
  ) {
    const parsed = parseCommentInput(updateCommentSchema, body);
    return this.workItemsService.updateComment(
      req.user.id,
      id,
      commentId,
      parsed.content,
      parsed.version,
    );
  }

  @Delete('work-items/:id/comments/:commentId')
  deleteComment(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() body: unknown,
  ) {
    const parsed = parseCommentInput(deleteCommentSchema, body ?? {});
    return this.workItemsService.deleteComment(
      req.user.id,
      id,
      commentId,
      parsed.version,
    );
  }

  @Get('work-items/:id/activity')
  getActivity(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.workItemsService.getActivity(req.user.id, id);
  }
}
