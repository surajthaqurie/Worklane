import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe.js';
import { AnalyticsService } from './analytics.service.js';
import {
  burndownQuerySchema,
  velocityQuerySchema,
  cumulativeFlowQuerySchema,
  timeToDoneQuerySchema,
  summaryQuerySchema,
  snapshotListQuerySchema,
  recomputeBodySchema,
} from './dto/analytics.dto.js';

@Controller('projects/:projectId/analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  private uid(req: any): string {
    return req.user.id;
  }

  /**
   * GET /projects/:projectId/analytics/burndown?iterationId=&teamId=
   * Historical sprint burndown replayed from history, transitions & timestamps.
   */
  @Get('burndown')
  burndown(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(burndownQuerySchema)) query: {
      iterationId?: string;
      teamId?: string;
    },
  ) {
    return this.analytics.getBurndown(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/velocity?from=&to=&teamId=
   * Completed points per iteration (committed vs completed).
   */
  @Get('velocity')
  velocity(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(velocityQuerySchema)) query: {
      from?: string;
      to?: string;
      teamId?: string;
    },
  ) {
    return this.analytics.getVelocity(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/cumulative-flow?from=&to=&bucketSizeDays=&groupBy=&teamId=
   * Cumulative flow diagram (category or workflow-state distribution over time).
   */
  @Get('cumulative-flow')
  cumulativeFlow(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(cumulativeFlowQuerySchema)) query: {
      from?: string;
      to?: string;
      bucketSizeDays?: number;
      groupBy?: 'category' | 'state';
      teamId?: string;
    },
  ) {
    return this.analytics.getCumulativeFlow(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/cycle-time?from=&to=&type=&limit=&teamId=
   * Time from first In Progress → done, for items completed in the window.
   */
  @Get('cycle-time')
  cycleTime(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(timeToDoneQuerySchema)) query: {
      from?: string;
      to?: string;
      type?: string;
      limit?: number;
      teamId?: string;
    },
  ) {
    return this.analytics.getCycleTime(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/lead-time?from=&to=&type=&limit=&teamId=
   * Time from creation → done, for items completed in the window.
   */
  @Get('lead-time')
  leadTime(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(timeToDoneQuerySchema)) query: {
      from?: string;
      to?: string;
      type?: string;
      limit?: number;
      teamId?: string;
    },
  ) {
    return this.analytics.getLeadTime(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/summary?from=&to=&teamId=
   * Rolled-up KPI numbers for the header cards.
   */
  @Get('summary')
  summary(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(summaryQuerySchema)) query: {
      from?: string;
      to?: string;
      teamId?: string;
    },
  ) {
    return this.analytics.getSummary(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/snapshots?kind=
   * Recently precomputed aggregation snapshots and their age.
   */
  @Get('snapshots')
  snapshots(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(snapshotListQuerySchema)) query: {
      kind?: string;
    },
  ) {
    return this.analytics.listSnapshots(
      this.uid(req),
      projectId,
      (query.kind as any) ?? undefined,
    );
  }

  /**
   * POST /projects/:projectId/analytics/recompute
   * Body: { from?, to? }
   * Dispatches a background ANALYTICS_CALCULATION job to precompute snapshots.
   */
  @Post('recompute')
  recompute(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(recomputeBodySchema)) body: {
      from?: string;
      to?: string;
    },
  ) {
    return this.analytics.recalculate(this.uid(req), projectId, body);
  }
}