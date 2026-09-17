import { Module } from '@nestjs/common';
import { IterationsController } from './iterations.controller.js';
import { IterationsService } from './iterations.service.js';
import { IterationsRepository } from './iterations.repository.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { TeamsModule } from '../teams/teams.module.js';

@Module({
  imports: [ProjectsModule, TeamsModule],
  controllers: [IterationsController],
  providers: [IterationsService, IterationsRepository],
  exports: [IterationsService],
})
export class IterationsModule {}
