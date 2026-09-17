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

  // ─── Members ───────────────────────────────────────────────────────────────

  @Get(':id/members')
  getMembers(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.getMembers(this.getUserId(req), id);
  }

  @Post(':id/members')
  addMember(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { userId: string; role?: 'OWNER' | 'ADMIN' | 'MEMBER' },
  ) {
    return this.projectsService.addMember(
      this.getUserId(req),
      id,
      body.userId,
      body.role ?? 'MEMBER',
    );
  }

  @Patch(':id/members/:userId/role')
  updateMemberRole(
    @Req() req: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { role: 'OWNER' | 'ADMIN' | 'MEMBER' },
  ) {
    return this.projectsService.updateMemberRole(
      this.getUserId(req),
      id,
      userId,
      body.role,
    );
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Req() req: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.projectsService.removeMember(this.getUserId(req), id, userId);
  }

  // ─── Project resources ─────────────────────────────────────────────────────

  @Get(':id/overview')
  getOverview(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.getOverview(this.getUserId(req), id);
  }

  @Get(':id/areas')
  getAreas(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.getAreas(this.getUserId(req), id);
  }

  @Get(':id/tags')
  getTags(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.getTags(this.getUserId(req), id);
  }

  // ─── Permissions ───────────────────────────────────────────────────────────

  /**
   * GET /projects/:id/my-permissions
   *
   * Returns the authenticated user's role and the full set of permissions they
   * have for this project. The frontend uses this to gate UI actions (buttons,
   * menus) without a round-trip per action.
   */
  @Get(':id/my-permissions')
  getMyPermissions(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.getMyPermissions(this.getUserId(req), id);
  }
}
