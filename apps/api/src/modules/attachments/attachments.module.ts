import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { ObjectStorageService } from './object-storage.service.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { BackgroundJobsModule } from '../background-jobs/background-jobs.module.js';

@Module({
  imports: [AuthorizationModule, BackgroundJobsModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, ObjectStorageService],
  exports: [AttachmentsService, ObjectStorageService],
})
export class AttachmentsModule {}
