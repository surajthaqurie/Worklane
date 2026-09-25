import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe.js';
import { AuditLoggerService } from './audit-logger.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';
import { auditLogQuerySchema } from './dto/audit-log-query.dto.js';
import type { AuditLogQueryDto } from './dto/audit-log-query.dto.js';

@Controller()
@UseGuards(AuthGuard)
export class AuditController {
  constructor(
    private readonly auditLogger: AuditLoggerService,
    private readonly authz: AuthorizationService,
  ) {}

  /**
   * GET /projects/:projectId/audit-logs
   * Retrieves security and administrative audit records for a project.
   * STRICTLY RESTRICTED to authorized administrative users (ADMIN, OWNER).
   * Regular members without AUDIT_LOG_VIEW permission are rejected with 403 Forbidden.
   */
  @Get('projects/:projectId/audit-logs')
  async getProjectAuditLogs(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(auditLogQuerySchema)) query: AuditLogQueryDto,
  ) {
    // Enforce administrative authorization via central authorization service
    await this.authz.requireProjectPermission(
      projectId,
      req.user.id,
      Permission.AUDIT_LOG_VIEW,
    );

    return this.auditLogger.getProjectAuditLogs(projectId, {
      page: query.page,
      limit: query.limit,
      actorId: query.actorId,
      eventType: query.eventType,
      from: query.from,
      to: query.to,
    });
  }
}
