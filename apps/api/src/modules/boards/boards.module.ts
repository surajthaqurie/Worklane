import { Module } from '@nestjs/common';
import { BoardsController } from './boards.controller.js';
import { BoardsService } from './boards.service.js';
import { BoardsRepository } from './boards.repository.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { WorkItemsModule } from '../work-items/work-items.module.js';

@Module({
  imports: [ProjectsModule, WorkItemsModule],
  controllers: [BoardsController],
  providers: [BoardsService, BoardsRepository],
  exports: [BoardsService, BoardsRepository],
})
export class BoardsModule {}
