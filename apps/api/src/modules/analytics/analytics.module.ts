import { Module, forwardRef } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsRepository } from './analytics.repository.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { TeamsModule } from '../teams/teams.module.js';
import { BackgroundJobsModule } from '../background-jobs/background-jobs.module.js';

/**
 * Phase 18 — Analytics & Reporting.
 *
 * History-driven metrics (sprint burndown, velocity, cumulative flow, cycle &
 * lead time) computed by replaying the immutable work-item event log. Read
 * endpoints are permission-gated; a background ANALYTICS_CALCULATION job
 * precomputes default-window snapshots that the read paths can serve.
 *
 * The BackgroundJobs circular dependency is required because the processor
 * invokes AnalyticsService.recalculateProject and our recompute endpoint
 * dispatches jobs through BackgroundJobsService.
 */
@Module({
  imports: [
    forwardRef(() => BackgroundJobsModule),
    AuthorizationModule,
    TeamsModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository],
  exports: [AnalyticsService, AnalyticsRepository],
})
export class AnalyticsModule {}