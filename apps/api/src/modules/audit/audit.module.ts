import { Global, Module } from '@nestjs/common';
import { AuditLoggerService } from './audit-logger.service.js';
import { AuditController } from './audit.controller.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';

@Global()
@Module({
  imports: [AuthorizationModule],
  controllers: [AuditController],
  providers: [AuditLoggerService],
  exports: [AuditLoggerService],
})
export class AuditModule {}
