import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/kysely.js';

export type AuditEventType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'PROJECT_CREATED'
  | 'PROJECT_DELETED'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'ROLE_CHANGED'
  | 'PERMISSION_DENIED';

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);

  /**
   * Records a security audit event in the `security_audit_logs` table.
   * Strips out any sensitive credentials (passwords, tokens, keys) from details.
   */
  async logEvent(
    eventType: AuditEventType,
    userId: string | null = null,
    projectId: string | null = null,
    details: Record<string, unknown> = {},
    ipAddress?: string,
  ): Promise<void> {
    try {
      // Security scrub: guarantee sensitive keys are never stored in audit logs
      const sanitizedDetails = { ...details };
      const sensitiveKeys = ['password', 'password_hash', 'currentPassword', 'newPassword', 'token', 'accessToken', 'refreshToken', 'secret'];
      for (const key of sensitiveKeys) {
        if (key in sanitizedDetails) {
          delete sanitizedDetails[key];
        }
      }

      await db
        .insertInto('security_audit_logs')
        .values({
          event_type: eventType,
          user_id: userId,
          project_id: projectId,
          ip_address: ipAddress || null,
          details: JSON.stringify(sanitizedDetails),
        })
        .execute();

      this.logger.log(`Audit Event [${eventType}] logged for user: ${userId || 'anonymous'}, project: ${projectId || 'global'}`);
    } catch (err) {
      // Audit log failures should not crash the main application request flow, but should be logged to stderr
      this.logger.error(`Failed to write security audit log for event ${eventType}:`, err);
    }
  }

  /**
   * Retrieves security audit logs for a specific project or user.
   */
  async getAuditLogs(params: { projectId?: string; userId?: string; limit?: number }) {
    const limit = params.limit || 50;
    let query = db.selectFrom('security_audit_logs').selectAll().orderBy('created_at', 'desc').limit(limit);

    if (params.projectId) {
      query = query.where('project_id', '=', params.projectId);
    }
    if (params.userId) {
      query = query.where('user_id', '=', params.userId);
    }

    return query.execute();
  }
}
