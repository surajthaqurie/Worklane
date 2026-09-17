import { Module } from '@nestjs/common';
import { QueriesController } from './queries.controller.js';
import { QueriesService } from './queries.service.js';
import { QueriesRepository } from './queries.repository.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';

@Module({
  imports: [ProjectsModule, AuthorizationModule],
  controllers: [QueriesController],
  providers: [QueriesService, QueriesRepository],
})
export class QueriesModule {}