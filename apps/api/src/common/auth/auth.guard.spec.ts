import { describe, it, expect } from 'vitest';
import { AuthGuard } from './auth.guard.js';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-worklane-access-key-2026';

function createMockContext(headers: Record<string, string>): { context: ExecutionContext; request: any } {
  const request: any = { headers };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('AuthGuard', () => {
  const guard = new AuthGuard();

  it('rejects unauthenticated requests without authorization header (throws 401)', () => {
    const { context } = createMockContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects requests with invalid JWT token (throws 401)', () => {
    const { context } = createMockContext({
      authorization: 'Bearer invalid.jwt.token',
    });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects requests with invalid authorization header format (throws 401)', () => {
    const { context } = createMockContext({
      authorization: 'Basic dXNlcjpwYXNz',
    });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('accepts requests with valid JWT token and attaches user to request', () => {
    const validToken = jwt.sign({ sub: 'user-123' }, JWT_SECRET, {
      expiresIn: '1h',
      algorithm: 'HS256',
    });
    const { context, request } = createMockContext({
      authorization: `Bearer ${validToken}`,
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.user).toEqual({ id: 'user-123' });
  });

  it('rejects tokens signed with invalid/unsupported algorithm', () => {
    // Attempting algorithm bypass / mismatch
    const unsignedToken = jwt.sign({ sub: 'user-123' }, '', { algorithm: 'none' });
    const { context } = createMockContext({
      authorization: `Bearer ${unsignedToken}`,
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
