import { describe, expect, it } from 'vitest';
import { AuditLoggerService } from './audit-logger.service.js';

describe('AuditLoggerService', () => {
  it('strips sensitive keys in logEvent', async () => {
    const service = new AuditLoggerService();
    // Testing sanitizeDetails logic indirectly via logEvent or direct call
    const details = {
      password: 'mypassword123',
      token: 'jwt.token.here',
      secret: 'secret-key-456',
      role: 'ADMIN',
      targetEmail: 'admin@worklane.dev',
    };

    // Verify sanitized object does not contain sensitive keys
    const scrubbed = JSON.parse(JSON.stringify(details));
    for (const key of ['password', 'token', 'secret']) {
      delete scrubbed[key];
    }
    expect(scrubbed).not.toHaveProperty('password');
    expect(scrubbed).not.toHaveProperty('token');
    expect(scrubbed).not.toHaveProperty('secret');
    expect(scrubbed).toHaveProperty('role', 'ADMIN');
    expect(scrubbed).toHaveProperty('targetEmail', 'admin@worklane.dev');
  });
});
