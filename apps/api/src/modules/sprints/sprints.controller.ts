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
import { SprintsService } from './sprints.service.js';
import {
  CreateSprintDto,
  UpdateSprintDto,
  AddWorkItemsDto,
} from './dto/sprints.dto.js';

@Controller('projects/:projectId/sprints')
@UseGuards(AuthGuard)
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  private getUserId(req: any) {
    return req.user.id;
  }

  @Post()
  create(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() createSprintDto: CreateSprintDto,
  ) {
    return this.sprintsService.create(
      this.getUserId(req),
      projectId,
      createSprintDto,
    );
  }

  @Get()
  findAll(@Req() req: any, @Param('projectId') projectId: string) {
    return this.sprintsService.findAllByProject(this.getUserId(req), projectId);
  }

  @Get(':id')
  findOne(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.sprintsService.findOne(this.getUserId(req), projectId, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() updateSprintDto: UpdateSprintDto,
  ) {
    return this.sprintsService.update(
      this.getUserId(req),
      projectId,
      id,
      updateSprintDto,
    );
  }

  @Post(':id/work-items')
  addWorkItems(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() addWorkItemsDto: AddWorkItemsDto,
  ) {
    return this.sprintsService.addWorkItems(
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
    return this.sprintsService.removeWorkItem(
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
    return this.sprintsService.getSprintWorkItems(
      this.getUserId(req),
      projectId,
      id,
    );
  }
}
