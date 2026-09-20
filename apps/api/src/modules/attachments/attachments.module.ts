import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { ObjectStorageService } from './object-storage.service.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';

@Module({
  imports: [AuthorizationModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, ObjectStorageService],
  exports: [AttachmentsService, ObjectStorageService],
})
export class AttachmentsModule {}
