import { Module, forwardRef } from '@nestjs/common';
import { BackgroundJobsRepository } from './background-jobs.repository.js';
import { BackgroundJobsProcessor } from './background-jobs.processor.js';
import { BackgroundJobsService } from './background-jobs.service.js';
import { BackgroundJobsController } from './background-jobs.controller.js';
import { BackgroundJobsQueue } from './queue/background-jobs.queue.js';
import { BackgroundJobsWorker } from './queue/background-jobs.worker.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';

@Module({
  imports: [forwardRef(() => AnalyticsModule)],
  controllers: [BackgroundJobsController],
  providers: [
    BackgroundJobsRepository,
    BackgroundJobsProcessor,
    BackgroundJobsQueue,
    BackgroundJobsWorker,
    BackgroundJobsService,
  ],
  exports: [BackgroundJobsService, BackgroundJobsProcessor, BackgroundJobsQueue, AnalyticsModule],
})
export class BackgroundJobsModule {}