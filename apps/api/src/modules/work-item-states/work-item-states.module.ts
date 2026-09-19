import { Module } from '@nestjs/common';
import { WorkItemStatesController } from './work-item-states.controller.js';
import { WorkItemStatesService } from './work-item-states.service.js';
import { WorkItemStatesRepository } from './work-item-states.repository.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';

@Module({
  imports: [ProjectsModule, AuthorizationModule],
  controllers: [WorkItemStatesController],
  providers: [WorkItemStatesService, WorkItemStatesRepository],
  exports: [WorkItemStatesRepository],
})
export class WorkItemStatesModule {}