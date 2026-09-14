import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { WorkItemsModule } from './modules/work-items/work-items.module.js';
import { SprintsModule } from './modules/sprints/sprints.module.js';

@Module({
  imports: [ProjectsModule, WorkItemsModule, SprintsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
