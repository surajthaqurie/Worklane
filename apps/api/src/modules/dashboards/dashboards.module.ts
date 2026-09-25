import { Module } from '@nestjs/common';
import { DashboardsController } from './dashboards.controller.js';
import { DashboardsService } from './dashboards.service.js';
import { DashboardsRepository } from './dashboards.repository.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';

@Module({
  imports: [AuthorizationModule, AnalyticsModule],
  controllers: [DashboardsController],
  providers: [DashboardsService, DashboardsRepository],
  exports: [DashboardsService, DashboardsRepository],
})
export class DashboardsModule {}
