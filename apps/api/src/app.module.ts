import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { WorkItemsModule } from './modules/work-items/work-items.module.js';
import { IterationsModule } from './modules/iterations/iterations.module.js';
import { WorkItemStatesModule } from './modules/work-item-states/work-item-states.module.js';
import { QueriesModule } from './modules/queries/queries.module.js';
import { TeamsModule } from './modules/teams/teams.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { BoardsModule } from './modules/boards/boards.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AttachmentsModule } from './modules/attachments/attachments.module.js';
import { AppExceptionFilter } from './common/exceptions/app-exception.filter.js';
import { IdempotencyModule } from './common/idempotency/idempotency.module.js';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.RATE_LIMIT_TTL || '60000', 10),
        limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      },
    ]),
    IdempotencyModule,
    AuditModule,
    AuthModule,
    ProjectsModule,
    WorkItemsModule,
    IterationsModule,
    WorkItemStatesModule,
    QueriesModule,
    TeamsModule,
    SearchModule,
    NotificationsModule,
    BoardsModule,
    AttachmentsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
