import { Module } from '@nestjs/common';
import { IterationsController } from './iterations.controller.js';
import { IterationsService } from './iterations.service.js';
import { IterationsRepository } from './iterations.repository.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { TeamsModule } from '../teams/teams.module.js';
import { WorkItemHistoryModule } from '../work-item-history/work-item-history.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';

import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [ProjectsModule, TeamsModule, WorkItemHistoryModule, AuthorizationModule, NotificationsModule],
  controllers: [IterationsController],
  providers: [IterationsService, IterationsRepository],
  exports: [IterationsService],
})
export class IterationsModule {}

