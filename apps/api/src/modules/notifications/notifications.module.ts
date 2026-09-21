import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { BackgroundJobsModule } from '../background-jobs/background-jobs.module.js';

@Module({
  imports: [AuthorizationModule, BackgroundJobsModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsGateway,
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
