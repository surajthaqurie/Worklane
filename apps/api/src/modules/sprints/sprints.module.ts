import { Module } from '@nestjs/common';
import { SprintsController } from './sprints.controller.js';
import { SprintsService } from './sprints.service.js';
import { SprintsRepository } from './sprints.repository.js';
import { ProjectsModule } from '../projects/projects.module.js';

@Module({
  imports: [ProjectsModule],
  controllers: [SprintsController],
  providers: [SprintsService, SprintsRepository],
  exports: [SprintsService],
})
export class SprintsModule {}
