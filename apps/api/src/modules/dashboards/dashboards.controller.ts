import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe.js';
import { DashboardsService } from './dashboards.service.js';
import {
  getDashboardDataQuerySchema,
  getDashboardLayoutQuerySchema,
  resetDashboardLayoutSchema,
  saveDashboardLayoutSchema,
} from './dto/dashboard.dto.js';
import type {
  GetDashboardDataQueryDto,
  GetDashboardLayoutQueryDto,
  ResetDashboardLayoutDto,
  SaveDashboardLayoutDto,
} from './dto/dashboard.dto.js';

@Controller('dashboards')
@UseGuards(AuthGuard)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  /**
   * GET /dashboards/layout?projectId=...
   * Retrieves the customized or default widget layout for the requested user and scope.
   */
  @Get('layout')
  async getLayout(
    @Req() req: any,
    @Query(new ZodValidationPipe(getDashboardLayoutQuerySchema))
    query: GetDashboardLayoutQueryDto,
  ) {
    return this.dashboardsService.getLayout(req.user.id, query.projectId);
  }

  /**
   * PUT /dashboards/layout
   * Persists widget layout (positions, sizes, visibility, scope).
   */
  @Put('layout')
  async saveLayout(
    @Req() req: any,
    @Body(new ZodValidationPipe(saveDashboardLayoutSchema))
    body: SaveDashboardLayoutDto,
  ) {
    return this.dashboardsService.saveLayout(
      req.user.id,
      body.projectId ?? null,
      body.widgets,
    );
  }

  /**
   * POST /dashboards/layout/reset
   * Resets layout back to system defaults.
   */
  @Post('layout/reset')
  async resetLayout(
    @Req() req: any,
    @Body(new ZodValidationPipe(resetDashboardLayoutSchema))
    body: ResetDashboardLayoutDto,
  ) {
    return this.dashboardsService.resetLayout(
      req.user.id,
      body.projectId ?? null,
    );
  }

  /**
   * GET /dashboards/data?projectId=...&teamId=...
   * Batched aggregation returning all widget metrics in a single cached call.
   */
  @Get('data')
  async getDashboardData(
    @Req() req: any,
    @Query(new ZodValidationPipe(getDashboardDataQuerySchema))
    query: GetDashboardDataQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader(
      'Cache-Control',
      'private, max-age=15, stale-while-revalidate=30',
    );
    return this.dashboardsService.getDashboardData(
      req.user.id,
      query.projectId,
      query.teamId,
    );
  }
}
