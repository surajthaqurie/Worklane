import { describe, expect, it } from 'vitest';
import type { AuditRecord } from '@/shared/types/audit';

function makeAuditRecord(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    id: 'aud-1',
    eventType: 'ROLE_CHANGED',
    actor: { id: 'u-admin', name: 'Admin User', email: 'admin@worklane.dev', avatarUrl: null },
    projectId: 'proj-1',
    ipAddress: '192.168.1.100',
    details: { memberId: 'u-member', previousRole: 'MEMBER', role: 'ADMIN' },
    summary: 'Changed role of Jane Doe from MEMBER to ADMIN',
    diff: {
      field: 'Role',
      before: 'MEMBER',
      after: 'ADMIN',
      target: 'Jane Doe',
    },
    createdAt: '2026-09-25T15:00:00Z',
    ...overrides,
  };
}

describe('Audit Log Models and Details', () => {
  it('correctly models administrative diffs with Before, After, and Target', () => {
    const record = makeAuditRecord();

    expect(record.eventType).toBe('ROLE_CHANGED');
    expect(record.diff?.field).toBe('Role');
    expect(record.diff?.before).toBe('MEMBER');
    expect(record.diff?.after).toBe('ADMIN');
    expect(record.diff?.target).toBe('Jane Doe');
    expect(record.summary).toBe('Changed role of Jane Doe from MEMBER to ADMIN');
  });

  it('handles permission denied security events without exposing credentials', () => {
    const record = makeAuditRecord({
      eventType: 'PERMISSION_DENIED',
      summary: 'Security: Permission denied for Hacker attempting "project:delete"',
      diff: {
        field: 'Permission Check',
        before: 'Unauthorized',
        after: 'Blocked',
        target: 'project:delete',
      },
      details: {
        permission: 'project:delete',
      },
    });

    expect(record.eventType).toBe('PERMISSION_DENIED');
    expect(record.diff?.before).toBe('Unauthorized');
    expect(record.diff?.after).toBe('Blocked');
    expect(record.details).not.toHaveProperty('password');
    expect(record.details).not.toHaveProperty('token');
  });
});
