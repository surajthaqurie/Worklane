import { Global, Module } from '@nestjs/common';
import { AuditLoggerService } from './audit-logger.service.js';

@Global()
@Module({
  providers: [AuditLoggerService],
  exports: [AuditLoggerService],
})
export class AuditModule {}
