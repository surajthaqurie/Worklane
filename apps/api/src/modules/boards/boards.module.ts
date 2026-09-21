import { Module } from '@nestjs/common';
import { BoardsController } from './boards.controller.js';
import { BoardsService } from './boards.service.js';
import { BoardsRepository } from './boards.repository.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { WorkItemsModule } from '../work-items/work-items.module.js';
import { TeamsModule } from '../teams/teams.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    ProjectsModule,
    WorkItemsModule,
    TeamsModule,
    AuthorizationModule,
    NotificationsModule,
  ],
  controllers: [BoardsController],
  providers: [BoardsService, BoardsRepository],
  exports: [BoardsService, BoardsRepository],
})
export class BoardsModule {}
