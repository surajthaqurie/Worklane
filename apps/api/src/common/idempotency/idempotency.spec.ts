import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdempotencyService } from './idempotency.service.js';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';
import { of } from 'rxjs';

describe('Idempotency Feature — Bulk Mutations & Retries', () => {
  let service: IdempotencyService;
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    service = new IdempotencyService();
    interceptor = new IdempotencyInterceptor(service);
  });

  describe('Key Extraction', () => {
    it('extracts key from Idempotency-Key header', () => {
      const req = { headers: { 'idempotency-key': 'key-123' } };
      expect(service.extractKey(req)).toBe('key-123');
    });

    it('extracts key from X-Idempotency-Key header', () => {
      const req = { headers: { 'x-idempotency-key': 'key-456' } };
      expect(service.extractKey(req)).toBe('key-456');
    });

    it('extracts key from request body idempotencyKey', () => {
      const req = { headers: {}, body: { idempotencyKey: 'key-789' } };
      expect(service.extractKey(req)).toBe('key-789');
    });

    it('returns null when no idempotency key is present', () => {
      const req = { headers: {}, body: {} };
      expect(service.extractKey(req)).toBeNull();
    });
  });

  describe('Interceptor & Duplicate Request Prevention', () => {
    it('executes handler on first call and returns cached response on duplicate request with same key', async () => {
      const handlerResult = { success: true, updatedCount: 5 };
      let handlerCallCount = 0;

      const mockHandler = {
        handle: () => {
          handlerCallCount++;
          return of(handlerResult);
        },
      };

      const mockReq = {
        headers: { 'idempotency-key': 'bulk-op-key-001' },
        user: { id: 'user-1' },
        url: '/projects/proj-1/backlog/bulk-assign-iteration',
      };

      const mockRes = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
      };

      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => mockRes,
        }),
      };

      // First invocation
      const obs1 = await interceptor.intercept(mockContext, mockHandler as any);
      let res1: any;
      obs1.subscribe((val) => (res1 = val));

      expect(handlerCallCount).toBe(1);
      expect(res1).toEqual(handlerResult);

      // Second invocation (retry with identical key)
      const obs2 = await interceptor.intercept(mockContext, mockHandler as any);
      let res2: any;
      obs2.subscribe((val) => (res2 = val));

      // Handler MUST NOT execute a second time!
      expect(handlerCallCount).toBe(1);
      expect(res2).toEqual(handlerResult);
    });

    it('executes handler for different idempotency keys', async () => {
      let handlerCallCount = 0;
      const mockHandler = {
        handle: () => {
          handlerCallCount++;
          return of({ success: true, count: handlerCallCount });
        },
      };

      const createMockReq = (key: string) => ({
        headers: { 'idempotency-key': key },
        user: { id: 'user-1' },
        url: '/projects/proj-1/backlog/bulk-assign-iteration',
      });

      const mockRes = { statusCode: 200, status: vi.fn() };

      const context1: any = {
        switchToHttp: () => ({
          getRequest: () => createMockReq('key-A'),
          getResponse: () => mockRes,
        }),
      };

      const context2: any = {
        switchToHttp: () => ({
          getRequest: () => createMockReq('key-B'),
          getResponse: () => mockRes,
        }),
      };

      await interceptor.intercept(context1, mockHandler as any);
      await interceptor.intercept(context2, mockHandler as any);

      expect(handlerCallCount).toBe(2);
    });

    it('scopes idempotency keys per user', async () => {
      let handlerCallCount = 0;
      const mockHandler = {
        handle: () => {
          handlerCallCount++;
          return of({ userResult: handlerCallCount });
        },
      };

      const mockRes = { statusCode: 200, status: vi.fn() };

      const user1Context: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'idempotency-key': 'shared-key' },
            user: { id: 'user-1' },
            url: '/bulk',
          }),
          getResponse: () => mockRes,
        }),
      };

      const user2Context: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'idempotency-key': 'shared-key' },
            user: { id: 'user-2' },
            url: '/bulk',
          }),
          getResponse: () => mockRes,
        }),
      };

      await interceptor.intercept(user1Context, mockHandler as any);
      await interceptor.intercept(user2Context, mockHandler as any);

      expect(handlerCallCount).toBe(2);
    });
  });
});
