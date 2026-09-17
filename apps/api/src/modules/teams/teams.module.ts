import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';
import { TeamsRepository } from './teams.repository.js';
import { ProjectsModule } from '../projects/projects.module.js';

@Module({
  imports: [ProjectsModule],
  controllers: [TeamsController],
  providers: [TeamsService, TeamsRepository],
  exports: [TeamsService],
})
export class TeamsModule {}