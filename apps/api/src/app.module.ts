import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { WorkItemsModule } from './modules/work-items/work-items.module.js';
import { IterationsModule } from './modules/iterations/iterations.module.js';
import { WorkItemStatesModule } from './modules/work-item-states/work-item-states.module.js';
import { QueriesModule } from './modules/queries/queries.module.js';

@Module({
  imports: [
    ProjectsModule,
    WorkItemsModule,
    IterationsModule,
    WorkItemStatesModule,
    QueriesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
