import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.js';
import { ProjectsService } from './projects.service.js';
import {
  CreateProjectDto,
  UpdateProjectDto,
} from './dto/projects.dto.js';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createProjectDto: CreateProjectDto,
  ) {
    return this.projectsService.create(user.id, createProjectDto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findAll(user.id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.projectsService.findOne(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(user.id, id, updateProjectDto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projectsService.remove(user.id, id);
  }

  // ─── Members ───────────────────────────────────────────────────────────────

  @Get(':id/members')
  getMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.projectsService.getMembers(user.id, id);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { userId: string; role?: 'OWNER' | 'ADMIN' | 'MEMBER' },
  ) {
    return this.projectsService.addMember(
      user.id,
      id,
      body.userId,
      body.role ?? 'MEMBER',
    );
  }

  @Patch(':id/members/:userId/role')
  updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { role: 'OWNER' | 'ADMIN' | 'MEMBER' },
  ) {
    return this.projectsService.updateMemberRole(user.id, id, userId, body.role);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.projectsService.removeMember(user.id, id, userId);
  }

  // ─── Project resources ─────────────────────────────────────────────────────

  @Get(':id/overview')
  getOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.projectsService.getOverview(user.id, id);
  }

  @Get(':id/areas')
  getAreas(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.projectsService.getAreas(user.id, id);
  }

  @Get(':id/tags')
  getTags(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projectsService.getTags(user.id, id);
  }

  @Get(':id/my-permissions')
  getMyPermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.projectsService.getMyPermissions(user.id, id);
  }
}
