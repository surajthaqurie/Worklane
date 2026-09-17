import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';
import { TeamsRepository } from './teams.repository.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';

@Module({
  imports: [ProjectsModule, AuthorizationModule],
  controllers: [TeamsController],
  providers: [TeamsService, TeamsRepository],
  exports: [TeamsService],
})
export class TeamsModule {}