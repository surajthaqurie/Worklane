import { Module } from '@nestjs/common';
import { WorkItemsController } from './work-items.controller.js';
import { WorkItemsService } from './work-items.service.js';
import { WorkItemsRepository } from './work-items.repository.js';
import { BacklogRepository } from './backlog.repository.js';
import { BacklogController } from './backlog.controller.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { TeamsModule } from '../teams/teams.module.js';
import { WorkItemHistoryModule } from '../work-item-history/work-item-history.module.js';

import { WorkItemTransitionsService } from './work-item-transitions.service.js';

@Module({
  imports: [ProjectsModule, TeamsModule, WorkItemHistoryModule],
  controllers: [WorkItemsController, BacklogController],
  providers: [WorkItemsService, WorkItemsRepository, BacklogRepository, WorkItemTransitionsService],
})
export class WorkItemsModule {}
