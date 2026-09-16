import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WorkItemStatesService } from './work-item-states.service.js';
import {
  CreateWorkItemStateDto,
  UpdateWorkItemStateDto,
  ReorderWorkItemStatesDto,
} from './dto/work-item-states.dto.js';
import { AuthGuard } from '../projects/auth.guard.js';

@Controller('projects/:projectId/work-item-states')
@UseGuards(AuthGuard)
export class WorkItemStatesController {
  constructor(private readonly statesService: WorkItemStatesService) {}

  private getUserId(req: any) {
    return req.user.id;
  }

  @Get()
  findAll(@Req() req: any, @Param('projectId') projectId: string) {
    return this.statesService.findAll(this.getUserId(req), projectId);
  }

  @Post()
  create(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: CreateWorkItemStateDto,
  ) {
    return this.statesService.create(this.getUserId(req), projectId, dto);
  }

  @Put('reorder')
  reorder(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: ReorderWorkItemStatesDto,
  ) {
    return this.statesService.reorder(
      this.getUserId(req),
      projectId,
      dto.orderedIds,
    );
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkItemStateDto,
  ) {
    return this.statesService.update(this.getUserId(req), projectId, id, dto);
  }

  @Delete(':id')
  remove(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.statesService.remove(this.getUserId(req), projectId, id);
  }
}