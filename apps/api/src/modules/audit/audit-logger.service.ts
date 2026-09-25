import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/kysely.js';

export type AuditEventType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'PROJECT_CREATED'
  | 'PROJECT_DELETED'
  | 'PROJECT_UPDATED'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'ROLE_CHANGED'
  | 'PERMISSION_DENIED'
  | 'TEAM_CREATED'
  | 'TEAM_UPDATED'
  | 'TEAM_DELETED'
  | string;

export interface AuditRecordDiff {
  field: string;
  before: string | null;
  after: string | null;
  target?: string | null;
}

export interface AuditRecord {
  id: string;
  eventType: string;
  actor: {
    id: string | null;
    name: string;
    email: string | null;
    avatarUrl: string | null;
  };
  projectId: string | null;
  ipAddress: string | null;
  details: Record<string, unknown>;
  summary: string;
  diff?: AuditRecordDiff;
  createdAt: Date;
}

export interface PaginatedAuditLog {
  items: AuditRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface AuditLogQueryParams {
  page?: number;
  limit?: number;
  actorId?: string;
  eventType?: string;
  from?: string;
  to?: string;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'secretKey',
  'authorization',
  'cookie',
  'session',
]);

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEYS.has(key)) {
      continue; // Redact/omit completely from audit output
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      clean[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

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
      const sanitizedDetails = sanitizeDetails(details);

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

      this.logger.log(
        `Audit Event [${eventType}] logged for user: ${userId || 'anonymous'}, project: ${projectId || 'global'}`,
      );
    } catch (err) {
      this.logger.error(`Failed to write security audit log for event ${eventType}:`, err);
    }
  }

  /**
   * Retrieves security audit logs for a specific project or user (legacy).
   */
  async getAuditLogs(params: { projectId?: string; userId?: string; limit?: number }) {
    const limit = Math.min(Math.max(1, params.limit || 50), 100);
    let query = db.selectFrom('security_audit_logs').selectAll().orderBy('created_at', 'desc').limit(limit);

    if (params.projectId) {
      query = query.where('project_id', '=', params.projectId);
    }
    if (params.userId) {
      query = query.where('user_id', '=', params.userId);
    }

    return query.execute();
  }

  /**
   * Retrieves paginated security and administrative audit records for a project.
   * Enforces pagination limits (never unlimited), sanitizes details, resolves actors and targets,
   * and derives human-readable diffs and summaries.
   */
  async getProjectAuditLogs(
    projectId: string,
    params: AuditLogQueryParams = {},
  ): Promise<PaginatedAuditLog> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(Math.max(1, params.limit || 25), 100);
    const offset = (page - 1) * limit;

    let baseQuery = db
      .selectFrom('security_audit_logs')
      .leftJoin('users', 'users.id', 'security_audit_logs.user_id')
      .where('security_audit_logs.project_id', '=', projectId);

    if (params.actorId) {
      baseQuery = baseQuery.where('security_audit_logs.user_id', '=', params.actorId);
    }

    if (params.eventType) {
      baseQuery = baseQuery.where('security_audit_logs.event_type', '=', params.eventType);
    }

    if (params.from) {
      baseQuery = baseQuery.where(
        'security_audit_logs.created_at',
        '>=',
        new Date(params.from),
      );
    }

    if (params.to) {
      baseQuery = baseQuery.where(
        'security_audit_logs.created_at',
        '<=',
        new Date(params.to),
      );
    }

    // Total count for pagination
    const countResult = await baseQuery
      .select(db.fn.count<string>('security_audit_logs.id').as('count'))
      .executeTakeFirst();
    const total = countResult ? parseInt(countResult.count, 10) : 0;

    const rows = await baseQuery
      .select([
        'security_audit_logs.id',
        'security_audit_logs.event_type',
        'security_audit_logs.user_id',
        'security_audit_logs.project_id',
        'security_audit_logs.ip_address',
        'security_audit_logs.details',
        'security_audit_logs.created_at',
        'users.name as user_name',
        'users.email as user_email',
        'users.avatar_url as user_avatar_url',
      ])
      .orderBy('security_audit_logs.created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    if (rows.length === 0) {
      return {
        items: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
        hasMore: false,
      };
    }

    // Collect target user IDs from details to resolve target names
    const targetUserIds = new Set<string>();
    for (const r of rows) {
      try {
        const details = typeof r.details === 'string' ? JSON.parse(r.details) : r.details;
        if (details?.memberId && typeof details.memberId === 'string') {
          targetUserIds.add(details.memberId);
        }
        if (details?.userId && typeof details.userId === 'string') {
          targetUserIds.add(details.userId);
        }
      } catch {
        // Ignore JSON parse errors for target lookups
      }
    }

    const targetUsersMap = new Map<string, { name: string; email: string }>();
    if (targetUserIds.size > 0) {
      const targetRows = await db
        .selectFrom('users')
        .where('id', 'in', [...targetUserIds])
        .select(['id', 'name', 'email'])
        .execute();
      for (const tu of targetRows) {
        targetUsersMap.set(tu.id, { name: tu.name, email: tu.email });
      }
    }

    const items: AuditRecord[] = rows.map((r) => {
      let rawDetails: Record<string, unknown> = {};
      try {
        rawDetails = typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {});
      } catch {
        rawDetails = {};
      }
      const details = sanitizeDetails(rawDetails);

      const actorName = r.user_name || (r.user_id ? 'Unknown User' : 'System');
      const targetId =
        typeof details.memberId === 'string'
          ? details.memberId
          : typeof details.userId === 'string'
            ? details.userId
            : null;
      const targetUser = targetId ? targetUsersMap.get(targetId) : null;
      const targetLabel =
        targetUser?.name ||
        (details.memberEmail ? String(details.memberEmail) : null) ||
        (details.targetEmail ? String(details.targetEmail) : null) ||
        targetId ||
        null;

      let summary = `${actorName} triggered ${r.event_type}`;
      let diff: AuditRecordDiff | undefined = undefined;

      switch (r.event_type) {
        case 'ROLE_CHANGED': {
          const prev = (details.previousRole as string) || 'MEMBER';
          const next = (details.role as string) || 'ADMIN';
          summary = targetLabel
            ? `Changed role of ${targetLabel} from ${prev} to ${next}`
            : `Changed role from ${prev} to ${next}`;
          diff = {
            field: 'Role',
            before: prev,
            after: next,
            target: targetLabel,
          };
          break;
        }
        case 'MEMBER_ADDED': {
          const role = (details.role as string) || 'MEMBER';
          summary = targetLabel
            ? `Added ${targetLabel} with role ${role}`
            : `Added member with role ${role}`;
          diff = {
            field: 'Membership',
            before: null,
            after: role,
            target: targetLabel,
          };
          break;
        }
        case 'MEMBER_REMOVED': {
          summary = targetLabel ? `Removed ${targetLabel} from project` : `Removed member from project`;
          diff = {
            field: 'Membership',
            before: 'MEMBER',
            after: null,
            target: targetLabel,
          };
          break;
        }
        case 'PROJECT_CREATED': {
          const projName = (details.name as string) || 'Project';
          summary = `Created project "${projName}"`;
          diff = {
            field: 'Project',
            before: null,
            after: projName,
          };
          break;
        }
        case 'PROJECT_UPDATED': {
          summary = `Updated project settings`;
          break;
        }
        case 'PROJECT_DELETED': {
          summary = `Deleted project`;
          break;
        }
        case 'PERMISSION_DENIED': {
          const permission = (details.permission as string) || 'unknown action';
          summary = `Security: Permission denied for ${actorName} attempting "${permission}"`;
          diff = {
            field: 'Permission Check',
            before: 'Unauthorized',
            after: 'Blocked',
            target: permission,
          };
          break;
        }
        case 'LOGIN': {
          summary = `${actorName} logged in`;
          break;
        }
        case 'LOGOUT': {
          summary = `${actorName} logged out`;
          break;
        }
        default:
          summary = `${actorName} performed ${r.event_type.replace(/_/g, ' ').toLowerCase()}`;
          break;
      }

      return {
        id: r.id,
        eventType: r.event_type,
        actor: {
          id: r.user_id,
          name: actorName,
          email: r.user_email || null,
          avatarUrl: r.user_avatar_url || null,
        },
        projectId: r.project_id,
        ipAddress: r.ip_address,
        details,
        summary,
        diff,
        createdAt: r.created_at,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    };
  }
}
