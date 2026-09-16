import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../projects/auth.guard.js';
import { IterationsService } from './iterations.service.js';
import {
  CreateIterationDto,
  UpdateIterationDto,
  AddWorkItemsDto,
} from './dto/iterations.dto.js';

@Controller('projects/:projectId/iterations')
@UseGuards(AuthGuard)
export class IterationsController {
  constructor(private readonly iterationsService: IterationsService) {}

  private getUserId(req: any) {
    return req.user.id;
  }

  @Post()
  create(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() createSprintDto: CreateIterationDto,
  ) {
    return this.iterationsService.create(
      this.getUserId(req),
      projectId,
      createSprintDto,
    );
  }

  @Get()
  findAll(@Req() req: any, @Param('projectId') projectId: string) {
    return this.iterationsService.findAllByProject(this.getUserId(req), projectId);
  }

  @Get(':id')
  findOne(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.iterationsService.findOne(this.getUserId(req), projectId, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() updateSprintDto: UpdateIterationDto,
  ) {
    return this.iterationsService.update(
      this.getUserId(req),
      projectId,
      id,
      updateSprintDto,
    );
  }

  @Delete(':id')
  remove(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.iterationsService.remove(this.getUserId(req), projectId, id);
  }

  @Post(':id/work-items')
  addWorkItems(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() addWorkItemsDto: AddWorkItemsDto,
  ) {
    return this.iterationsService.addWorkItems(
      this.getUserId(req),
      projectId,
      id,
      addWorkItemsDto,
    );
  }

  @Delete(':id/work-items/:workItemId')
  removeWorkItem(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Param('workItemId') workItemId: string,
  ) {
    return this.iterationsService.removeWorkItem(
      this.getUserId(req),
      projectId,
      id,
      workItemId,
    );
  }

  @Get(':id/work-items')
  getWorkItems(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.iterationsService.getSprintWorkItems(
      this.getUserId(req),
      projectId,
      id,
    );
  }
}
