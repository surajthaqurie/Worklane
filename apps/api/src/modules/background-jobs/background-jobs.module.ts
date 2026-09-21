import { Module } from '@nestjs/common';
import { BackgroundJobsRepository } from './background-jobs.repository.js';
import { BackgroundJobsProcessor } from './background-jobs.processor.js';
import { BackgroundJobsService } from './background-jobs.service.js';
import { BackgroundJobsController } from './background-jobs.controller.js';
import { BackgroundJobsQueue } from './queue/background-jobs.queue.js';
import { BackgroundJobsWorker } from './queue/background-jobs.worker.js';

@Module({
  controllers: [BackgroundJobsController],
  providers: [
    BackgroundJobsRepository,
    BackgroundJobsProcessor,
    BackgroundJobsQueue,
    BackgroundJobsWorker,
    BackgroundJobsService,
  ],
  exports: [BackgroundJobsService, BackgroundJobsProcessor, BackgroundJobsQueue],
})
export class BackgroundJobsModule {}