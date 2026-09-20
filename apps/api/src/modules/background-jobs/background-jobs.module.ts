import { Module } from '@nestjs/common';
import { BackgroundJobsRepository } from './background-jobs.repository.js';
import { BackgroundJobsProcessor } from './background-jobs.processor.js';
import { BackgroundJobsService } from './background-jobs.service.js';
import { BackgroundJobsController } from './background-jobs.controller.js';

@Module({
  controllers: [BackgroundJobsController],
  providers: [
    BackgroundJobsRepository,
    BackgroundJobsProcessor,
    BackgroundJobsService,
  ],
  exports: [BackgroundJobsService, BackgroundJobsProcessor, BackgroundJobsRepository],
})
export class BackgroundJobsModule {}
