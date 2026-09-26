import { Controller, Get, Post, Delete, Body, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe.js';
import { AnalyticsService } from './analytics.service.js';
import {
  burndownQuerySchema,
  velocityQuerySchema,
  cumulativeFlowQuerySchema,
  timeToDoneQuerySchema,
  summaryQuerySchema,
  analyticsFiltersSchema,
  throughputQuerySchema,
  snapshotListQuerySchema,
  recomputeBodySchema,
  createSavedReportSchema,
  CreateSavedReportDto,
} from './dto/analytics.dto.js';

@Controller()
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  private uid(req: any): string {
    return req.user.id;
  }

  // ─── Project Analytics Endpoints ──────────────────────────────────────────

  /**
   * GET /projects/:projectId/analytics/summary
   * GET /projects/:projectId/analytics/overview
   * Rolled-up KPI numbers for header cards.
   */
  @Get('projects/:projectId/analytics/summary')
  summary(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(analyticsFiltersSchema)) query: any,
  ) {
    return this.analytics.getSummary(this.uid(req), projectId, query);
  }

  @Get('projects/:projectId/analytics/overview')
  overview(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(analyticsFiltersSchema)) query: any,
  ) {
    return this.analytics.getSummary(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/project-health
   * Overall project health, progress bars, and distributions.
   */
  @Get('projects/:projectId/analytics/project-health')
  projectHealth(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(analyticsFiltersSchema)) query: any,
  ) {
    return this.analytics.getProjectHealth(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/team
   * Team workload, performance, throughput, velocity & cycle time.
   */
  @Get('projects/:projectId/analytics/team')
  teamAnalytics(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(analyticsFiltersSchema)) query: any,
  ) {
    return this.analytics.getTeamAnalytics(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/iteration
   * Iteration/sprint progress report, scope additions/removals, burndown.
   */
  @Get('projects/:projectId/analytics/iteration')
  iterationReport(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query('iterationId') iterationId: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.analytics.getIterationReport(this.uid(req), projectId, { iterationId, teamId });
  }

  /**
   * GET /projects/:projectId/analytics/burndown
   * Historical sprint burndown.
   */
  @Get('projects/:projectId/analytics/burndown')
  burndown(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(burndownQuerySchema)) query: { iterationId?: string; teamId?: string },
  ) {
    return this.analytics.getBurndown(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/velocity
   * Completed story points per iteration.
   */
  @Get('projects/:projectId/analytics/velocity')
  velocity(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(velocityQuerySchema)) query: any,
  ) {
    return this.analytics.getVelocity(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/throughput
   * Completed work items over time (grouped by day/week/month).
   */
  @Get('projects/:projectId/analytics/throughput')
  throughput(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(throughputQuerySchema)) query: any,
  ) {
    return this.analytics.getThroughput(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/cumulative-flow
   * Cumulative flow diagram over time.
   */
  @Get('projects/:projectId/analytics/cumulative-flow')
  cumulativeFlow(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(cumulativeFlowQuerySchema)) query: any,
  ) {
    return this.analytics.getCumulativeFlow(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/cycle-time
   * Cycle time (In Progress -> Done).
   */
  @Get('projects/:projectId/analytics/cycle-time')
  cycleTime(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(timeToDoneQuerySchema)) query: any,
  ) {
    return this.analytics.getCycleTime(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/lead-time
   * Lead time (Created -> Done).
   */
  @Get('projects/:projectId/analytics/lead-time')
  leadTime(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(timeToDoneQuerySchema)) query: any,
  ) {
    return this.analytics.getLeadTime(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/aging
   * Aging active work items report.
   */
  @Get('projects/:projectId/analytics/aging')
  aging(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(analyticsFiltersSchema)) query: any,
  ) {
    return this.analytics.getAging(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/overdue
   * Overdue work items report.
   */
  @Get('projects/:projectId/analytics/overdue')
  overdue(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(analyticsFiltersSchema)) query: any,
  ) {
    return this.analytics.getOverdue(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/blocked
   * Blocked work items report.
   */
  @Get('projects/:projectId/analytics/blocked')
  blocked(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(analyticsFiltersSchema)) query: any,
  ) {
    return this.analytics.getBlocked(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/work-distribution
   * Distribution across type, state, priority, area, assignee.
   */
  @Get('projects/:projectId/analytics/work-distribution')
  workDistribution(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(analyticsFiltersSchema)) query: any,
  ) {
    return this.analytics.getWorkDistribution(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/state-transitions
   * State transitions & time-in-state analytics.
   */
  @Get('projects/:projectId/analytics/state-transitions')
  stateTransitions(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(analyticsFiltersSchema)) query: any,
  ) {
    return this.analytics.getStateTransitions(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/trends
   * Trends over time (open items, completed, cycle time, throughput).
   */
  @Get('projects/:projectId/analytics/trends')
  trends(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(analyticsFiltersSchema)) query: any,
  ) {
    return this.analytics.getTrends(this.uid(req), projectId, query);
  }

  /**
   * GET /projects/:projectId/analytics/export
   * Export report data as CSV.
   */
  @Get('projects/:projectId/analytics/export')
  async export(
    @Req() req: any,
    @Res() res: Response,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(analyticsFiltersSchema)) query: any,
  ) {
    const file = await this.analytics.exportCsv(this.uid(req), projectId, query);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    return res.status(200).send(file.content);
  }

  // ─── Saved Reports ────────────────────────────────────────────────────────

  @Get('projects/:projectId/analytics/saved-reports')
  listSavedReports(@Req() req: any, @Param('projectId') projectId: string) {
    return this.analytics.listSavedReports(this.uid(req), projectId);
  }

  @Post('projects/:projectId/analytics/saved-reports')
  createSavedReport(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createSavedReportSchema)) body: CreateSavedReportDto,
  ) {
    return this.analytics.createSavedReport(this.uid(req), projectId, body);
  }

  @Delete('projects/:projectId/analytics/saved-reports/:id')
  deleteSavedReport(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') reportId: string,
  ) {
    return this.analytics.deleteSavedReport(this.uid(req), projectId, reportId);
  }

  // ─── Organization Analytics ───────────────────────────────────────────────

  @Get('orgs/:orgId/analytics/overview')
  orgOverview(@Req() req: any, @Param('orgId') orgId: string) {
    return this.analytics.getOrgOverview(this.uid(req), orgId);
  }

  // ─── Snapshots & Background Aggregations ──────────────────────────────────

  @Get('projects/:projectId/analytics/snapshots')
  snapshots(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(snapshotListQuerySchema)) query: { kind?: string },
  ) {
    return this.analytics.listSnapshots(this.uid(req), projectId, (query.kind as any) ?? undefined);
  }

  @Post('projects/:projectId/analytics/recompute')
  recompute(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(recomputeBodySchema)) body: { from?: string; to?: string },
  ) {
    return this.analytics.recalculate(this.uid(req), projectId, body);
  }
}