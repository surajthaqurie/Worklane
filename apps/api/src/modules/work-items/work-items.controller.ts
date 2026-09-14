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
import { AuthGuard } from '../projects/auth.guard.js';

@Controller()
@UseGuards(AuthGuard)
export class WorkItemsController {
  constructor(private readonly workItemsService: WorkItemsService) {}

  @Post('projects/:projectId/work-items')
  create(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() createDto: CreateWorkItemDto,
  ) {
    return this.workItemsService.create(req.user.id, projectId, createDto);
  }

  @Get('projects/:projectId/work-items')
  findAll(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query() query: any,
  ) {
    return this.workItemsService.findAll(req.user.id, projectId, query);
  }

  @Get('work-items/:id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.workItemsService.findOne(req.user.id, id);
  }

  @Patch('work-items/:id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateDto: UpdateWorkItemDto,
  ) {
    return this.workItemsService.update(req.user.id, id, updateDto);
  }

  @Delete('work-items/:id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.workItemsService.remove(req.user.id, id);
  }

  @Get('work-items/:id/comments')
  getComments(@Req() req: any, @Param('id') id: string) {
    return this.workItemsService.getComments(req.user.id, id);
  }

  @Post('work-items/:id/comments')
  addComment(
    @Req() req: any,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.workItemsService.addComment(req.user.id, id, content);
  }

  @Patch('work-items/:id/comments/:commentId')
  updateComment(
    @Req() req: any,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body('content') content: string,
  ) {
    return this.workItemsService.updateComment(
      req.user.id,
      id,
      commentId,
      content,
    );
  }

  @Delete('work-items/:id/comments/:commentId')
  deleteComment(
    @Req() req: any,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
  ) {
    return this.workItemsService.deleteComment(req.user.id, id, commentId);
  }

  @Get('work-items/:id/activity')
  getActivity(@Req() req: any, @Param('id') id: string) {
    return this.workItemsService.getActivity(req.user.id, id);
  }
}
