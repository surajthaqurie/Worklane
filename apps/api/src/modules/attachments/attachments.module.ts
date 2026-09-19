import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';

@Module({
  imports: [AuthorizationModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
