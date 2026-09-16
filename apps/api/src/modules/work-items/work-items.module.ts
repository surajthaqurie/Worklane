import { Module } from '@nestjs/common';
import { WorkItemsController } from './work-items.controller.js';
import { WorkItemsService } from './work-items.service.js';
import { WorkItemsRepository } from './work-items.repository.js';
import { ProjectsModule } from '../projects/projects.module.js';

import { WorkItemTransitionsService } from './work-item-transitions.service.js';

@Module({
  imports: [ProjectsModule],
  controllers: [WorkItemsController],
  providers: [WorkItemsService, WorkItemsRepository, WorkItemTransitionsService],
})
export class WorkItemsModule {}
