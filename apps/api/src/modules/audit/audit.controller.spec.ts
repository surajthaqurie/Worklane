import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuditController } from './audit.controller.js';
import { AuditLoggerService } from './audit-logger.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';
import { ForbiddenException } from '@nestjs/common';

describe('AuditController', () => {
  let controller: AuditController;
  let auditLogger: AuditLoggerService;
  let authz: AuthorizationService;

  beforeEach(() => {
    auditLogger = {
      getProjectAuditLogs: vi.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 0,
        hasMore: false,
      }),
      logEvent: vi.fn(),
      getAuditLogs: vi.fn(),
    } as unknown as AuditLoggerService;

    authz = {
      requireProjectPermission: vi.fn().mockResolvedValue({
        projectId: 'p1',
        userId: 'u-admin',
        role: 'ADMIN',
      }),
    } as unknown as AuthorizationService;

    controller = new AuditController(auditLogger, authz);
  });

  it('allows authorized administrative user with AUDIT_LOG_VIEW permission', async () => {
    const req = { user: { id: 'u-admin' } };
    const query = { page: 1, limit: 25, eventType: 'ROLE_CHANGED' };

    const result = await controller.getProjectAuditLogs(req, 'p1', query);

    expect(authz.requireProjectPermission).toHaveBeenCalledWith(
      'p1',
      'u-admin',
      Permission.AUDIT_LOG_VIEW,
    );
    expect(auditLogger.getProjectAuditLogs).toHaveBeenCalledWith('p1', {
      page: 1,
      limit: 25,
      actorId: undefined,
      eventType: 'ROLE_CHANGED',
      from: undefined,
      to: undefined,
    });
    expect(result).toHaveProperty('items');
  });

  it('rejects regular members without AUDIT_LOG_VIEW permission with 403 Forbidden', async () => {
    vi.mocked(authz.requireProjectPermission).mockRejectedValueOnce(
      new ForbiddenException('Access denied: requires audit_log:view permission'),
    );

    const req = { user: { id: 'u-member' } };
    const query = { page: 1, limit: 25 };

    await expect(controller.getProjectAuditLogs(req, 'p1', query)).rejects.toThrow(
      ForbiddenException,
    );
    expect(auditLogger.getProjectAuditLogs).not.toHaveBeenCalled();
  });
});
