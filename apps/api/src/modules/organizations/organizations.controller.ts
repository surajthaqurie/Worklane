import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.js';
import { OrganizationsService } from './organizations.service.js';
import type {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  AddOrganizationMemberDto,
  UpdateOrganizationMemberRoleDto,
} from './dto/organizations.dto.js';

@Controller('organizations')
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.service.create(user.id, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.service.update(id, user.id, dto);
  }

  @Get(':id/members')
  getMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.getMembers(id, user.id);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddOrganizationMemberDto,
  ) {
    return this.service.addMember(id, user.id, dto);
  }

  @Patch(':id/members/:userId/role')
  updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateOrganizationMemberRoleDto,
  ) {
    return this.service.updateMemberRole(id, user.id, targetUserId, dto.role);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.service.removeMember(id, user.id, targetUserId);
  }

  @Get(':id/projects')
  getProjects(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.getProjects(id, user.id);
  }

  @Get(':id/my-role')
  getMyRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.getMyRole(id, user.id);
  }
}
