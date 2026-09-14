import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';
import { ProjectsService } from './projects.service.js';
import {
  CreateProjectDto,
  UpdateProjectDto,
  AddProjectMemberDto,
} from './dto/projects.dto.js';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // Mocking userId for demonstration purposes, normally from JWT Auth Guard
  private getUserId(req: any) {
    return req.user.id;
  }

  @Post()
  create(@Req() req: any, @Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(this.getUserId(req), createProjectDto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.projectsService.findAll(this.getUserId(req));
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.findOne(this.getUserId(req), id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(
      this.getUserId(req),
      id,
      updateProjectDto,
    );
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.remove(this.getUserId(req), id);
  }

  @Post(':id/members')
  addMember(
    @Req() req: any,
    @Param('id') id: string,
    @Body() addMemberDto: AddProjectMemberDto,
  ) {
    return this.projectsService.addMember(
      this.getUserId(req),
      id,
      addMemberDto.userId,
    );
  }

  @Get(':id/overview')
  getOverview(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.getOverview(this.getUserId(req), id);
  }

  @Get(':id/members')
  getMembers(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.getMembers(this.getUserId(req), id);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Req() req: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.projectsService.removeMember(this.getUserId(req), id, userId);
  }
}
