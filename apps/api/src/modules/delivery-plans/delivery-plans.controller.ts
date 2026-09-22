import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DeliveryPlansService } from './delivery-plans.service.js';
import {
  CreateDeliveryPlanDto,
  UpdateDeliveryPlanDto,
  SetPlanTeamsDto,
} from './dto/delivery-plans.dto.js';
import { AuthGuard } from '../../common/auth/auth.guard.js';

@Controller('projects/:projectId/delivery-plans')
@UseGuards(AuthGuard)
export class DeliveryPlansController {
  constructor(private readonly deliveryPlansService: DeliveryPlansService) {}

  private uid(req: any): string {
    return req.user.id;
  }

  @Get()
  findAll(@Req() req: any, @Param('projectId') projectId: string) {
    return this.deliveryPlansService.findAll(this.uid(req), projectId);
  }

  @Post()
  create(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: CreateDeliveryPlanDto,
  ) {
    return this.deliveryPlansService.create(this.uid(req), projectId, dto);
  }

  @Get(':planId')
  findOne(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
  ) {
    return this.deliveryPlansService.findOne(this.uid(req), projectId, planId);
  }

  @Patch(':planId')
  update(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
    @Body() dto: UpdateDeliveryPlanDto,
  ) {
    return this.deliveryPlansService.update(this.uid(req), projectId, planId, dto);
  }

  @Delete(':planId')
  remove(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
  ) {
    return this.deliveryPlansService.remove(this.uid(req), projectId, planId);
  }

  // ─── Plan teams ─────────────────────────────────────────────────────────────

  @Get(':planId/teams')
  getTeams(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
  ) {
    return this.deliveryPlansService.getPlanTeams(this.uid(req), projectId, planId);
  }

  @Patch(':planId/teams')
  setTeams(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
    @Body() dto: SetPlanTeamsDto,
  ) {
    return this.deliveryPlansService.setPlanTeams(this.uid(req), projectId, planId, dto);
  }

  // ─── Timeline ───────────────────────────────────────────────────────────────

  /**
   * GET /projects/:projectId/delivery-plans/:planId/timeline
   * Returns the aggregated cross-team timeline:
   *   teams, iterations, work items, dependencies (all scoped to the caller's
   *   authorized organizations/projects/teams).
   *
   * Query params (all optional):
   *   teamId       — restrict to one team
   *   iterationId  — restrict to one iteration
   *   limit/offset — paginate large plans (work items are never fully loaded)
   */
  @Get(':planId/timeline')
  getTimeline(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
    @Query() query: Record<string, any>,
  ) {
    return this.deliveryPlansService.getTimeline(this.uid(req), projectId, planId, query);
  }
}