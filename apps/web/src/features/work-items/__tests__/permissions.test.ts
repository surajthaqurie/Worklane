import { describe, it, expect } from 'vitest';
import { ApiError } from '@/shared/types/api';

describe('403 error detection', () => {
  it('identifies a 403 ApiError correctly', () => {
    const err = new ApiError('Forbidden', 403, { code: 'FORBIDDEN' });
    expect(err instanceof ApiError).toBe(true);
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Forbidden');
  });

  it('distinguishes 403 from 404', () => {
    const err403 = new ApiError('Forbidden', 403, null);
    const err404 = new ApiError('Not Found', 404, null);
    expect(err403.statusCode).toBe(403);
    expect(err404.statusCode).toBe(404);
  });

  it('distinguishes 403 from a regular Error', () => {
    const regularError = new Error('Something failed');
    expect(regularError instanceof ApiError).toBe(false);
  });
});
