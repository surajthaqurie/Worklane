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
import { TeamsService } from './teams.service.js';
import {
  CreateTeamDto,
  UpdateTeamDto,
  AddTeamMemberDto,
  UpdateTeamMemberDto,
  UpdateTeamSettingsDto,
} from './dto/teams.dto.js';

@Controller('projects/:projectId/teams')
@UseGuards(AuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  private uid(req: any): string {
    return req.user.id;
  }

  // ─── Teams ─────────────────────────────────────────────────────────────────

  @Get()
  findAll(@Req() req: any, @Param('projectId') projectId: string) {
    return this.teamsService.findAll(this.uid(req), projectId);
  }

  @Post()
  create(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamsService.create(this.uid(req), projectId, dto);
  }

  @Get(':teamId')
  findOne(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.teamsService.findOne(this.uid(req), projectId, teamId);
  }

  @Patch(':teamId')
  update(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.update(this.uid(req), projectId, teamId, dto);
  }

  @Delete(':teamId')
  remove(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.teamsService.remove(this.uid(req), projectId, teamId);
  }

  // ─── Members ───────────────────────────────────────────────────────────────

  @Get(':teamId/members')
  getMembers(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.teamsService.getMembers(this.uid(req), projectId, teamId);
  }

  @Post(':teamId/members')
  addMember(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.teamsService.addMember(this.uid(req), projectId, teamId, {
      userId: dto.userId,
      role: dto.role ?? 'MEMBER',
    });
  }

  @Patch(':teamId/members/:userId')
  updateMemberRole(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.teamsService.updateMemberRole(
      this.uid(req),
      projectId,
      teamId,
      targetUserId,
      dto.role,
    );
  }

  @Delete(':teamId/members/:userId')
  removeMember(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.teamsService.removeMember(this.uid(req), projectId, teamId, targetUserId);
  }

  // ─── Settings ──────────────────────────────────────────────────────────────

  @Get(':teamId/settings')
  getSettings(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.teamsService.getSettings(this.uid(req), projectId, teamId);
  }

  @Patch(':teamId/settings')
  updateSettings(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
    @Body() dto: UpdateTeamSettingsDto,
  ) {
    return this.teamsService.updateSettings(this.uid(req), projectId, teamId, dto);
  }
}