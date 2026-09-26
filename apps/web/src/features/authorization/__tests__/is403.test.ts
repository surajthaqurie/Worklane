import { describe, it, expect } from 'vitest';
import { ApiError } from '@/shared/types/api';
import { is403, is404, isApiStatus } from '../utils/is403';

describe('is403', () => {
  it('returns true for a 403 ApiError', () => {
    expect(is403(new ApiError('Forbidden', 403, null))).toBe(true);
  });

  it('returns false for a 404 ApiError', () => {
    expect(is403(new ApiError('Not found', 404, null))).toBe(false);
  });

  it('returns false for a plain Error', () => {
    expect(is403(new Error('generic'))).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(is403(null)).toBe(false);
    expect(is403('string')).toBe(false);
    expect(is403(403)).toBe(false);
  });
});

describe('is404', () => {
  it('returns true for a 404 ApiError', () => {
    expect(is404(new ApiError('Not found', 404, null))).toBe(true);
  });

  it('returns false for a 403 ApiError', () => {
    expect(is404(new ApiError('Forbidden', 403, null))).toBe(false);
  });
});

describe('isApiStatus', () => {
  it('matches specific status codes', () => {
    expect(isApiStatus(new ApiError('Conflict', 409, null), 409)).toBe(true);
    expect(isApiStatus(new ApiError('Conflict', 409, null), 422)).toBe(false);
  });
});
